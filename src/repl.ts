import readline from 'readline';
import fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { execa } from 'execa';
import inquirer from 'inquirer';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import { GemmaClient, Message } from './ollama.js';

// @ts-ignore
marked.setOptions({
  renderer: new TerminalRenderer() as any
});

async function saveLog(path: string, history: Message[], model: string, systemPrompt?: string, topics: string[] = []) {
  try {
    let content = `# Gemma Chat Log\n\n`;
    content += `- **Date**: ${new Date().toLocaleString()}\n`;
    content += `- **Model**: ${model}\n`;
    if (systemPrompt) content += `- **System Prompt**: ${systemPrompt}\n`;
    if (topics.length > 0) content += `- **Topics**: ${topics.join(', ')}\n`;
    content += `\n---\n\n`;
    
    content += history.map(m => `### ${m.role.toUpperCase()}\n\n${m.content}\n`).join('\n---\n\n');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fullPath = path.endsWith('.md') ? path : `${path}_${timestamp}.md`;
    fs.writeFileSync(fullPath, content);
    return fullPath;
  } catch (error: any) {
    throw new Error(`Failed to save log: ${error.message}`);
  }
}

async function handleShellExecution(content: string) {
  const shellRegex = /```(?:bash|sh|shell|powershell|ps1)\n([\s\S]*?)```/g;
  const matches = [...content.matchAll(shellRegex)];
  
  if (matches.length === 0) return;

  for (const match of matches) {
    const command = match[1].trim();
    console.log(chalk.yellow('\nGemma proposed a shell command:'));
    console.log(chalk.grey('-----------------------------------'));
    console.log(chalk.white(command));
    console.log(chalk.grey('-----------------------------------'));

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Do you want to execute this command?',
      default: false
    }]);

    if (confirm) {
      try {
        console.log(chalk.blue(`Executing: ${command}`));
        const { stdout, stderr } = await execa(command, { shell: true });
        if (stdout) console.log(stdout);
        if (stderr) console.error(chalk.red(stderr));
      } catch (error: any) {
        console.error(chalk.red(`Execution failed: ${error.message}`));
      }
    }
  }
}

export async function startREPL(modelName: string, systemPrompt?: string, logPath?: string, initialHistory: Message[] = []) {
  const client = new GemmaClient(modelName, systemPrompt);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green('you> '),
  });

  const history: Message[] = [...initialHistory];
  const topics: string[] = [];
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
        } else {
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
        } else {
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

        // Check for shell commands
        await handleShellExecution(fullResponse);

      } catch (error: any) {
        spinner.stop();
        console.error(chalk.red(`\nChat Error: ${error.message}`));
      }
    } catch (globalError: any) {
      console.error(chalk.red(`\nSystem Error: ${globalError.message}`));
    }

    rl.prompt();
  }).on('close', () => {
    console.log(chalk.bold('\nGoodbye!'));
    process.exit(0);
  });
}
