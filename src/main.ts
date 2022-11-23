import {
  App,
  MarkdownPostProcessorContext,
  MarkdownRenderChild,
  Plugin,
  PluginSettingTab,
  Setting,
} from 'obsidian';

interface CBLSettings {
  ignoreLanguages?: string;
  showLanguageAsLabel: boolean;
}

const DEFAULT_SETTINGS: CBLSettings = {
  ignoreLanguages: 'dataview\ndataviewjs\ntasks',
  showLanguageAsLabel: true,
};

// Regex which matches the first line of a fenced codeblock and gets the info we need from it as capture groups
const REGEX_FENCED_CODEBLOCK_START =
  /^```(?<lang>[^\s^{]+)?\s*(?:{(?<label>[^}]+)})?/;

export default class CBLPlugin extends Plugin {
  settings: CBLSettings;

  async onload() {
    await this.loadSettings();

    // Register callbacks, settings tab, etc.
    this.registerMarkdownPostProcessor((el, ctx) =>
      this.markdownPostProcessor(el, ctx)
    );

    this.addSettingTab(new CBLSettingTab(this.app, this));
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  markdownPostProcessor(el: HTMLElement, ctx: MarkdownPostProcessorContext) {
    const settings = this.settings;

    const ignoreLanguages = this.settings.ignoreLanguages
      ? this.settings.ignoreLanguages.trim().split('\n')
      : [];

    // Only modify codeblocks, which are rendered as a code tag inside a pre tag
    if (!el.querySelector('pre > code')) {
      return;
    }

    // Get the section info from ctx
    const section = ctx.getSectionInfo(el);
    if (section == null) {
      return;
    }

    // Get the text that corresponds to this section, and make sure it's a fenced code block
    const lines = section.text
      .split('\n')
      .map((s) => s.trim())
      .slice(section.lineStart, section.lineEnd + 1);

    if (
      lines.length < 2 ||
      !lines[0].startsWith('```') ||
      !lines.last().endsWith('```')
    ) {
      return;
    }

    // Match the start of the code block with the regex
    const match = lines[0].match(REGEX_FENCED_CODEBLOCK_START);
    if (match == null) {
      return;
    }

    const language = match.groups['lang'];

    // Ignore languages
    if (ignoreLanguages.includes(language)) {
      console.log(`ignoring ${language}`);
      return;
    }

    // Determine what to use for the label
    // Use the label contents by default if set
    let labelText = match.groups['label'];

    // If an explicit label wasn't set but showLanguageAsLabel is true, use the language
    if (labelText == null && settings.showLanguageAsLabel) {
      labelText = language;
    }

    // Return early if there's no label to show
    if (labelText == null) {
      return;
    }

    // Create the label element
    const label = document.createElement('p');
    label.addClass('codeblock-label');
    label.setText(labelText);

    el.prepend(label);
    el.addClass('labeled-codeblock');
    el.dataset.language = language;
    ctx.addChild(new MarkdownRenderChild(label));
  }
}

class CBLSettingTab extends PluginSettingTab {
  plugin: CBLPlugin;

  constructor(app: App, plugin: CBLPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();
    containerEl.createEl('h2', { text: 'Code Block Label Settings' });

    new Setting(containerEl)
      .setName('Show Language as Label')
      .setDesc(
        'If no label is given but there is a set highlight language show that language as the label.'
      )
      .addToggle((tgl) =>
        tgl
          .setValue(this.plugin.settings.showLanguageAsLabel)
          .onChange(async (value) => {
            this.plugin.settings.showLanguageAsLabel = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Ignore')
      .setDesc('Ignore languages, one per line')
      .addTextArea((text) =>
        text
          .setValue(this.plugin.settings.ignoreLanguages)
          .onChange(async (val) => {
            this.plugin.settings.ignoreLanguages = val;
            this.plugin.saveSettings();
          })
      );
  }
}
