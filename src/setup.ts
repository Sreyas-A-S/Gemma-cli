import { execa } from 'execa';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';

async function checkOllama() {
  try {
    await execa('ollama', ['--version']);
    return true;
  } catch {
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

  // 2. Check for the model
  const modelName = 'gemma4';
  const spinner = ora(`Checking for ${modelName} model...`).start();
  
  try {
    const { stdout } = await execa('ollama', ['list']);
    if (stdout.includes(modelName)) {
      spinner.succeed(chalk.green(`✅ Model ${modelName} is already installed.`));
    } else {
      spinner.info(chalk.yellow(`📝 Model ${modelName} not found.`));
      const { download } = await inquirer.prompt([{
        type: 'confirm',
        name: 'download',
        message: `Would you like to download ${modelName} (approx 10GB) now?`,
        default: true
      }]);

      if (download) {
        console.log(chalk.blue(`\nStarting download... This may take a while.`));
        const downloadProcess = execa('ollama', ['pull', modelName]);
        downloadProcess.stdout?.pipe(process.stdout);
        await downloadProcess;
        console.log(chalk.green(`\n✅ Model ${modelName} downloaded successfully!`));
      }
    }
  } catch (error: any) {
    spinner.fail(chalk.red('Failed to verify models.'));
    console.error(error.message);
  }

  console.log(chalk.bold.green('\n🎉 Setup complete! You can now run "npm start" to begin.'));
}

runSetup();
