import CommandLineArgs from 'command-line-args';
import CommandLineUsage from 'command-line-usage';

const optionDefinitions = [
  {
    name: '*',
    type: String,
    multiple: true,
    defaultOption: true,
  },
  {
    name: 'no-watch',
    type: Boolean,
    description: 'Do not monitor folders for changes',
  },
  {
    name: 'no-shutdown',
    type: Boolean,
    description: 'Do not exit script when browser window closes'
  },
  {
    name: 'json',
    alias: 'j',
    type: Boolean,
    description: 'Output component information in JSON format',
  },
  {
    name: 'port',
    alias: 'p',
    type: Number,
    description: 'Port number to use (default = 8118)',
  },
  {
    name: 'help',
    alias: 'h',
    type: Boolean,
    description: 'Print this usage guide'
  }
];
const scriptDescription = [
  {
    header: 'Trambar Deco',
    content: 'Generates preview of component descriptions.'
  },
  {
    header: 'Options',
    optionList: optionDefinitions.filter((def) => {
      return !def.defaultOption;
    })
  }
];

function parseCommandLine() {
  try {
    const options = CommandLineArgs(optionDefinitions);
    if (options.help) {
      const usage = CommandLineUsage(scriptDescription);
      console.log(usage);
      process.exit(0);
    }
    return options;
  } catch(err) {
    console.error(err.message);
    process.exit(-1);
  }
}

export {
  parseCommandLine
};
