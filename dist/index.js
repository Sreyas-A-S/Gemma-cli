#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { GemmaClient } from './ollama.js';
import { startREPL } from './repl.js';
const program = new Command();
program
    .name('gemma')
    .description('A local CLI for Gemma 4 models')
    .version('1.0.0');
function findGeminiFiles(startDir) {
    const files = [];
    let currentDir = startDir;
    while (true) {
        const geminiPath = path.join(currentDir, 'GEMINI.md');
        if (fs.existsSync(geminiPath)) {
            files.push(geminiPath);
        }
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir)
            break;
        currentDir = parentDir;
    }
    return files;
}
import { execa } from 'execa';
async function verifyModel(modelName) {
    try {
        const { stdout } = await execa('ollama', ['list']);
        if (!stdout.includes(modelName))
            return { exists: false, running: true };
        return { exists: true, running: true };
    }
    catch (error) {
        return { exists: false, running: false };
    }
}
program
    .option('-p, --prompt <text>', 'Send a single prompt to the model')
    .option('-m, --model <name>', 'Specify the model to use', 'codeqwen')
    .option('-s, --system <text>', 'Define the system prompt (personality)')
    .option('-l, --log <path>', 'Path to save the conversation log')
    .option('-f, --file <paths...>', 'Pass local files as context for the model')
    .option('--code', 'Enable coding-optimized mode')
    .action(async (options) => {
    // Verify model and service
    const status = await verifyModel(options.model);
    if (!status.running) {
        console.error(chalk.red(`\n❌ Error: Could not connect to Ollama.`));
        console.log(chalk.yellow(`Please make sure the Ollama app is running in your taskbar.\n`));
        process.exit(1);
    }
    if (!status.exists) {
        console.error(chalk.red(`\n❌ Error: Model "${options.model}" is not installed.`));
        console.log(chalk.yellow(`Run "npm run setup" to download the model.\n`));
        process.exit(1);
    }
    let systemPrompt = options.system || "";
    // Auto-load GEMINI.md instructions
    const geminiFiles = findGeminiFiles(process.cwd());
    if (geminiFiles.length > 0) {
        systemPrompt += "\n\nPROJECT INSTRUCTIONS:\n";
        for (const file of geminiFiles) {
            systemPrompt += fs.readFileSync(file, 'utf-8') + "\n";
            console.log(chalk.dim(`Loaded instructions from: ${file}`));
        }
    }
    if (options.code) {
        systemPrompt += "\n\nYou are an expert Senior Software Engineer. You have the ability to EDIT FILES and RUN COMMANDS on the user's system (with their permission).";
        systemPrompt += "\n\n1. To EDIT or CREATE a file, use this exact format:\n[WRITE_FILE: path/to/file]\n```language\ncontent\n```";
        systemPrompt += "\n2. To RUN a command, put it in a single-line markdown block: ```bash\\nls -la\\n```";
        systemPrompt += "\n\nAlways provide high-quality code. Use modern best practices and prioritize security.";
    }
    const client = new GemmaClient(options.model, systemPrompt);
    const initialMessages = [];
    // Process file attachments
    if (options.file && options.file.length > 0) {
        for (const filePath of options.file) {
            try {
                const absolutePath = path.resolve(filePath);
                const content = fs.readFileSync(absolutePath, 'utf-8');
                const fileName = path.basename(filePath);
                initialMessages.push({
                    role: 'user',
                    content: `Context from file "${fileName}":\n\`\`\`\n${content}\n\`\`\``
                });
                console.log(chalk.dim(`Loaded context from: ${filePath}`));
            }
            catch (error) {
                console.error(chalk.red(`Error reading file ${filePath}: ${error.message}`));
            }
        }
        initialMessages.push({ role: 'user', content: "I have provided some code context above. Please acknowledge if you've received it and are ready for my instructions." });
    }
    if (options.prompt) {
        const messages = [...initialMessages, { role: 'user', content: options.prompt }];
        process.stdout.write(chalk.blue('Gemma: '));
        try {
            let fullResponse = '';
            for await (const chunk of client.streamChat(messages)) {
                process.stdout.write(chunk);
                fullResponse += chunk;
            }
            process.stdout.write('\n');
        }
        catch (error) {
            console.error(chalk.red(`\nError: ${error.message}`));
        }
    }
    else {
        await startREPL(options.model, systemPrompt, options.log, initialMessages);
    }
});
program.parse(process.argv);
