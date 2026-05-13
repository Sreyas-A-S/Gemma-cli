import readline from 'readline';
import fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { execa } from 'execa';
import path from 'path';
import inquirer from 'inquirer';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import { GemmaClient } from './ollama.js';
// @ts-ignore
marked.setOptions({
    renderer: new TerminalRenderer()
});
async function saveLog(path, history, model, systemPrompt, topics = []) {
    try {
        let content = `# Gemma Chat Log\n\n`;
        content += `- **Date**: ${new Date().toLocaleString()}\n`;
        content += `- **Model**: ${model}\n`;
        if (systemPrompt)
            content += `- **System Prompt**: ${systemPrompt}\n`;
        if (topics.length > 0)
            content += `- **Topics**: ${topics.join(', ')}\n`;
        content += `\n---\n\n`;
        content += history.map(m => `### ${m.role.toUpperCase()}\n\n${m.content}\n`).join('\n---\n\n');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fullPath = path.endsWith('.md') ? path : `${path}_${timestamp}.md`;
        fs.writeFileSync(fullPath, content);
        return fullPath;
    }
    catch (error) {
        throw new Error(`Failed to save log: ${error.message}`);
    }
}
async function handleFileEdits(content) {
    // Pattern: [WRITE_FILE: path/to/file] \n ```language \n code \n ```
    const fileRegex = /\[WRITE_FILE:\s*(.*?)\]\s*[\r\n]+```(?:\w+)?[\r\n]+([\s\S]*?)```/g;
    const matches = [...content.matchAll(fileRegex)];
    if (matches.length === 0)
        return;
    for (const match of matches) {
        const filePath = match[1].trim();
        const fileContent = match[2].trim();
        console.log(chalk.cyan(`\nGemma wants to write to file: ${chalk.bold(filePath)}`));
        console.log(chalk.grey('-----------------------------------'));
        console.log(chalk.dim(fileContent.substring(0, 200) + (fileContent.length > 200 ? '...' : '')));
        console.log(chalk.grey('-----------------------------------'));
        const { confirm } = await inquirer.prompt([{
                type: 'confirm',
                name: 'confirm',
                message: `Apply these changes to ${filePath}?`,
                default: false
            }]);
        if (confirm) {
            try {
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir))
                    fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(filePath, fileContent);
                console.log(chalk.green(`✅ File ${filePath} updated successfully!`));
            }
            catch (error) {
                console.error(chalk.red(`Failed to write file: ${error.message}`));
            }
        }
    }
}
async function handleShellExecution(content) {
    const shellRegex = /```(?:bash|sh|shell|powershell|ps1)\n([\s\S]*?)```/g;
    const matches = [...content.matchAll(shellRegex)];
    if (matches.length === 0)
        return;
    for (const match of matches) {
        const command = match[1].trim();
        if (command.includes('\n'))
            continue; // Ignore multi-line blocks for safety unless specifically requested
        console.log(chalk.yellow('\nGemma proposed a shell command:'));
        console.log(chalk.grey('-----------------------------------'));
        console.log(chalk.white(command));
        console.log(chalk.grey('-----------------------------------'));
        const { confirm } = await inquirer.prompt([{
                type: 'confirm',
                name: 'confirm',
                message: 'Execute this command?',
                default: false
            }]);
        if (confirm) {
            try {
                const { stdout, stderr } = await execa(command, { shell: true });
                if (stdout)
                    console.log(chalk.dim(stdout));
                if (stderr)
                    console.error(chalk.red(stderr));
            }
            catch (error) {
                console.error(chalk.red(`Execution failed: ${error.message}`));
            }
        }
    }
}
export async function startREPL(modelName, systemPrompt, logPath, initialHistory = []) {
    const client = new GemmaClient(modelName, systemPrompt);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.green('you> '),
    });
    const history = [...initialHistory];
    const topics = [];
    let currentTopic = 'General';
    console.log(chalk.bold(`\nStarting Gemma CLI REPL (Model: ${modelName})`));
    if (systemPrompt) {
        console.log(chalk.dim(`System Prompt: ${systemPrompt}`));
    }
    console.log(chalk.dim('Type "help" for a list of commands.\n'));
    rl.prompt();
    rl.on('line', async (line) => {
        try {
            const input = line.trim();
            const cmdParts = input.split(' ');
            const cmd = cmdParts[0].toLowerCase();
            if (cmd === 'exit' || cmd === 'quit') {
                if (logPath && history.length > 0) {
                    const savedAt = await saveLog(logPath, history, modelName, systemPrompt, topics);
                    console.log(chalk.yellow(`\nConversation saved to: ${savedAt}`));
                }
                rl.close();
                return;
            }
            if (cmd === 'topic') {
                const topicName = cmdParts.slice(1).join(' ');
                if (!topicName) {
                    console.log(chalk.blue(`Current topic: ${currentTopic}`));
                }
                else {
                    currentTopic = topicName;
                    topics.push(currentTopic);
                    console.log(chalk.yellow(`Topic changed to: ${currentTopic}`));
                    history.push({ role: 'system', content: `--- Topic Change: ${currentTopic} ---` });
                }
                rl.prompt();
                return;
            }
            if (cmd === 'help') {
                console.log(chalk.bold('\nAvailable Commands:'));
                console.log(`  ${chalk.cyan('topic <name>')} - Set the current work phase`);
                console.log(`  ${chalk.cyan('clear')}        - Reset conversation history`);
                console.log(`  ${chalk.cyan('save')}         - Export current chat to Markdown`);
                console.log(`  ${chalk.cyan('exit')}         - Leave the REPL`);
                console.log(`  ${chalk.cyan('help')}         - Show this list\n`);
                rl.prompt();
                return;
            }
            if (cmd === 'clear') {
                history.length = 0;
                console.log(chalk.yellow('Conversation history cleared.'));
                rl.prompt();
                return;
            }
            if (cmd === 'save') {
                if (history.length === 0) {
                    console.log(chalk.red('Nothing to save yet.'));
                }
                else {
                    const path = logPath || 'gemma_chat';
                    const savedAt = await saveLog(path, history, modelName, systemPrompt, topics);
                    console.log(chalk.yellow(`Conversation exported to: ${savedAt}`));
                }
                rl.prompt();
                return;
            }
            if (!input) {
                rl.prompt();
                return;
            }
            history.push({ role: 'user', content: input });
            const spinner = ora({
                text: chalk.blue('Gemma is thinking...'),
                color: 'blue'
            }).start();
            try {
                let fullResponse = '';
                let firstChunk = true;
                for await (const chunk of client.streamChat(history)) {
                    if (firstChunk) {
                        spinner.stop();
                        process.stdout.write(chalk.blue('gemma> '));
                        firstChunk = false;
                    }
                    process.stdout.write(chunk);
                    fullResponse += chunk;
                }
                process.stdout.write('\n');
                history.push({ role: 'assistant', content: fullResponse });
                // Check for file edits
                await handleFileEdits(fullResponse);
                // Check for shell commands
                await handleShellExecution(fullResponse);
            }
            catch (error) {
                spinner.stop();
                console.error(chalk.red(`\nChat Error: ${error.message}`));
            }
        }
        catch (globalError) {
            console.error(chalk.red(`\nSystem Error: ${globalError.message}`));
        }
        rl.prompt();
    }).on('close', () => {
        console.log(chalk.bold('\nGoodbye!'));
        process.exit(0);
    });
}
