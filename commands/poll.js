const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'poll',
    description: 'Create an advanced poll with time limits and multiple features',
    async execute(message, args) {
        if (!args.length) {
            return message.reply('❌ Please provide a question for the poll!\n**Usage:** `!poll "Question" "Option 1" "Option 2" [time:5m] [anonymous] [multiple]`\n**Examples:**\n• `!poll "What\'s your favorite color?" "Red" "Blue" "Green"`\n• `!poll "Should we have a movie night?" time:10m`\n• `!poll "Pick your hobbies" "Gaming" "Reading" "Sports" multiple anonymous`');
        }
        
        try {
            const content = args.join(' ');
            
            // Parse time limit (e.g., time:5m, time:1h, time:30s)
            const timeMatch = content.match(/time:(\d+)([smhd])/i);
            let timeLimit = null;
            let timeString = '';
            
            if (timeMatch) {
                const amount = parseInt(timeMatch[1]);
                const unit = timeMatch[2].toLowerCase();
                const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
                timeLimit = amount * multipliers[unit];
                
                const units = { s: 'second', m: 'minute', h: 'hour', d: 'day' };
                timeString = `${amount} ${units[unit]}${amount > 1 ? 's' : ''}`;
                
                if (timeLimit > 7 * 24 * 60 * 60 * 1000) { // Max 7 days
                    return message.reply('❌ Poll duration cannot exceed 7 days!');
                }
            }
            
            // Check for anonymous and multiple choice flags
            const isAnonymous = /\banonymous\b/i.test(content);
            const isMultiple = /\bmultiple\b/i.test(content);
            
            // Clean content by removing flags
            const cleanContent = content
                .replace(/time:\d+[smhd]/gi, '')
                .replace(/\banonymous\b/gi, '')
                .replace(/\bmultiple\b/gi, '')
                .trim();
            
            // Check if custom options are provided
            const optionsMatch = cleanContent.match(/"([^"]+)"/g);
            let question = cleanContent;
            let options = [];
            
            if (optionsMatch && optionsMatch.length > 1) {
                question = optionsMatch[0].replace(/"/g, '');
                options = optionsMatch.slice(1).map(opt => opt.replace(/"/g, ''));
                
                if (options.length > 10) {
                    const err = new EmbedBuilder()
                        .setTitle('❌ Too Many Options')
                        .setDescription('You can only provide up to **10** poll options.')
                        .setColor('#E74C3C');
                    return message.reply({ embeds: [err] });
                }
            } else if (optionsMatch && optionsMatch.length === 1) {
                question = optionsMatch[0].replace(/"/g, '');
            }
            
            // Delete the command message
            await message.delete();
            
            const embed = new EmbedBuilder()
                .setTitle('📊 Advanced Poll')
                .setDescription(`**${question}**`)
                .setColor('#4834d4')
                .setAuthor({ 
                    name: isAnonymous ? 'Anonymous Poll' : message.author.tag, 
                    iconURL: isAnonymous ? message.guild.iconURL({ dynamic: true }) : message.author.displayAvatarURL({ dynamic: true }) 
                })
                .setFooter({ text: 'Jebrila System | By APOllO ❤ V69©' })
                .setTimestamp();
            
            // Add poll settings info
            let settingsText = '';
            if (timeLimit) settingsText += `⏰ Duration: ${timeString}\n`;
            if (isAnonymous) settingsText += '🕵️ Anonymous voting\n';
            if (isMultiple) settingsText += '☑️ Multiple choice allowed\n';
            if (settingsText) {
                embed.addFields({ name: '⚙️ Poll Settings', value: settingsText, inline: false });
            }
            
            // If custom options are provided, add them to the embed
            if (options.length > 0) {
                const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
                let optionsText = '';
                
                options.forEach((option, index) => {
                    optionsText += `${numberEmojis[index]} ${option}\n`;
                });
                
                embed.addFields({ name: '📋 Options:', value: optionsText, inline: false });
            }
            
            // Add voting instructions
            let instructionsText = options.length > 0 
                ? 'React with the number emoji to vote for your choice'
                : 'React with ✅ for Yes or ❌ for No';
            
            if (isMultiple && options.length > 0) {
                instructionsText += ' (multiple selections allowed)';
            }
            
            embed.addFields({ name: '📝 How to Vote', value: instructionsText, inline: false });
            
            // Add end time if time limit is set
            if (timeLimit) {
                const endTime = Math.floor((Date.now() + timeLimit) / 1000);
                embed.addFields({ name: '⏱️ Poll Ends', value: `<t:${endTime}:R>`, inline: true });
            }
            
            // Send the poll
            const pollMessage = await message.channel.send({ embeds: [embed] });
            
            // Add reactions
            const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
            
            if (options.length > 0) {
                for (let i = 0; i < options.length; i++) {
                    await pollMessage.react(numberEmojis[i]);
                }
            } else {
                // Default yes/no poll
                await pollMessage.react('✅');
                await pollMessage.react('❌');
            }
            
            // Add control buttons
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`poll_results_${pollMessage.id}`)
                        .setLabel('📊 Show Results')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`poll_end_${pollMessage.id}`)
                        .setLabel('🔒 End Poll')
                        .setStyle(ButtonStyle.Danger)
                );
            
            await pollMessage.edit({ embeds: [embed], components: [row] });
            
            // Set up automatic poll ending if time limit is specified
            if (timeLimit) {
                setTimeout(async () => {
                    try {
                        const updatedMessage = await pollMessage.fetch();
                        await endPoll(updatedMessage, question, options, numberEmojis, isAnonymous, message.author);
                    } catch (error) {
                        console.error('Error ending poll automatically:', error);
                    }
                }, timeLimit);
            }
            
            // Store poll data for button interactions
            if (!message.client.polls) message.client.polls = new Map();
            message.client.polls.set(pollMessage.id, {
                question,
                options,
                numberEmojis,
                isAnonymous,
                isMultiple,
                creator: message.author.id,
                channel: message.channel.id,
                guild: message.guild.id
            });
            
        } catch (error) {
            console.error('Error creating poll:', error);
            message.channel.send('❌ An error occurred while creating the poll.');
        }
    },
};

// Helper function to end poll and show results
async function endPoll(pollMessage, question, options, numberEmojis, isAnonymous, creator) {
    try {
        const reactions = pollMessage.reactions.cache;
        let totalVotes = 0;
        const results = [];
        
        if (options.length > 0) {
            // Custom options poll
            for (let i = 0; i < options.length; i++) {
                const reaction = reactions.get(numberEmojis[i]);
                const count = reaction ? reaction.count - 1 : 0; // Subtract bot's reaction
                results.push({ option: options[i], votes: count, emoji: numberEmojis[i] });
                totalVotes += count;
            }
        } else {
            // Yes/No poll
            const yesReaction = reactions.get('✅');
            const noReaction = reactions.get('❌');
            const yesVotes = yesReaction ? yesReaction.count - 1 : 0;
            const noVotes = noReaction ? noReaction.count - 1 : 0;
            
            results.push({ option: 'Yes', votes: yesVotes, emoji: '✅' });
            results.push({ option: 'No', votes: noVotes, emoji: '❌' });
            totalVotes = yesVotes + noVotes;
        }
        
        // Sort results by vote count
        results.sort((a, b) => b.votes - a.votes);
        
        // Create results embed
        const resultsEmbed = new EmbedBuilder()
            .setTitle('📊 Poll Results')
            .setDescription(`**${question}**`)
            .setColor('#00ff00')
            .setAuthor({ 
                name: isAnonymous ? 'Anonymous Poll' : creator.tag, 
                iconURL: isAnonymous ? pollMessage.guild.iconURL({ dynamic: true }) : creator.displayAvatarURL({ dynamic: true }) 
            })
            .setFooter({ text: 'Jebrila System | By APOllO ❤ V69©' })
            .setTimestamp();
        
        if (totalVotes > 0) {
            let resultsText = '';
            results.forEach((result, index) => {
                const percentage = ((result.votes / totalVotes) * 100).toFixed(1);
                const barLength = Math.round((result.votes / Math.max(...results.map(r => r.votes))) * 10);
                const bar = '█'.repeat(barLength) + '░'.repeat(10 - barLength);
                
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
                resultsText += `${medal} ${result.emoji} **${result.option}**\n`;
                resultsText += `${bar} ${result.votes} votes (${percentage}%)\n\n`;
            });
            
            resultsEmbed.addFields({ name: '📈 Results', value: resultsText, inline: false });
        } else {
            resultsEmbed.addFields({ name: '📈 Results', value: 'No votes were cast.', inline: false });
        }
        
        // Update the message with results and remove components
        await pollMessage.edit({ embeds: [resultsEmbed], components: [] });
        
        // Remove poll data from memory
        if (pollMessage.client.polls) {
            pollMessage.client.polls.delete(pollMessage.id);
        }
        
    } catch (error) {
        console.error('Error ending poll:', error);
    }
}