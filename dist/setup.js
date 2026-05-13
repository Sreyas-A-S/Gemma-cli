import { execa } from 'execa';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
async function checkOllama() {
    try {
        await execa('ollama', ['--version']);
        return true;
    }
    catch {
        return false;
    }
}
async function runSetup() {
    console.log(chalk.bold.blue('\n--- Gemma CLI Setup ---\n'));
    // 1. Check if Ollama is installed
    const hasOllama = await checkOllama();
    if (!hasOllama) {
        console.error(chalk.red('❌ Ollama is not installed or not in your PATH.'));
        console.log('Please download it from https://ollama.com/ and try again.');
        process.exit(1);
    }
    console.log(chalk.green('✅ Ollama is installed.'));
    // 2. Model Selection
    const models = [
        { name: 'codeqwen', desc: 'Best for Coding (4.2GB)', value: 'codeqwen' },
        { name: 'llama3.1', desc: 'Best Generalist (4.7GB)', value: 'llama3.1' },
        { name: 'gemma:2b', desc: 'Lightweight & Fast (1.6GB)', value: 'gemma:2b' },
        { name: 'gemma2:9b', desc: 'Most Intelligent (5.4GB)', value: 'gemma2:9b' }
    ];
    const { selectedModels } = await inquirer.prompt([{
            type: 'checkbox',
            name: 'selectedModels',
            message: 'Which models would you like to install?',
            choices: models.map(m => ({ name: `${m.name} - ${m.desc}`, value: m.value })),
            default: ['codeqwen']
        }]);
    for (const modelName of selectedModels) {
        const spinner = ora(`Checking for ${modelName} model...`).start();
        try {
            const { stdout } = await execa('ollama', ['list']);
            if (stdout.includes(modelName)) {
                spinner.succeed(chalk.green(`✅ Model ${modelName} is already installed.`));
            }
            else {
                spinner.info(chalk.yellow(`📝 Model ${modelName} not found.`));
                console.log(chalk.blue(`\nStarting download of ${modelName}...`));
                const downloadProcess = execa('ollama', ['pull', modelName]);
                downloadProcess.stdout?.pipe(process.stdout);
                await downloadProcess;
                console.log(chalk.green(`\n✅ Model ${modelName} downloaded successfully!`));
            }
        }
        catch (error) {
            spinner.fail(chalk.red(`Failed to verify/download ${modelName}.`));
        }
    }
    // 3. Register the command globally
    const registerSpinner = ora('Registering "gemma" command globally...').start();
    try {
        // We use npm link to register the bin command defined in package.json
        await execa('npm', ['link']);
        registerSpinner.succeed(chalk.green('✅ "gemma" command registered successfully!'));
    }
    catch (error) {
        registerSpinner.warn(chalk.yellow('⚠️ Could not register "gemma" command globally automatically.'));
        console.log(chalk.dim('   (You may need to run "npm link" manually with administrative privileges)'));
    }
    console.log(chalk.bold.green('\n🎉 Setup complete! You can now run "gemma" from anywhere.'));
}
runSetup();
