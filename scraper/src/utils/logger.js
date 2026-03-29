import chalk from 'chalk';
import { SingleBar, Presets } from 'cli-progress';

export const log = {
  info:    (...a) => console.log(chalk.cyan('ℹ'), ...a),
  success: (...a) => console.log(chalk.green('✓'), ...a),
  warn:    (...a) => console.log(chalk.yellow('⚠'), ...a),
  error:   (...a) => console.error(chalk.red('✗'), ...a),
  section: (title) => {
    console.log('\n' + chalk.bold.white('━'.repeat(50)));
    console.log(chalk.bold.white(`  ${title}`));
    console.log(chalk.bold.white('━'.repeat(50)));
  },
};

export function makeProgressBar(label) {
  const bar = new SingleBar(
    {
      format: `  ${chalk.cyan(label)} [{bar}] {percentage}% | {value}/{total} | ETA: {eta}s`,
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true,
    },
    Presets.shades_classic
  );
  return bar;
}
