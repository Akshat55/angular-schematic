import { Tree } from '@angular-devkit/schematics';
import { getWorkspace } from '@schematics/angular/utility/workspace';

const importReplacementMap: { [key: string]: string } = {
  'variables': 'variables',
  '@carbon/themes/scss/index': '@carbon/styles/scss/theme',
  '@carbon/themes/scss/themes': '@carbon/themes/scss/themes',
  '@carbon/type/scss/*': '@carbon/styles/scss/type'
};

const tokenReplacementMap: { [key: string]: string } = {
  "body-short-01": "body-compact-01",
  "body-short-02": "body-compact-02",
  "body-long-01": "body-01",
  "body-long-02": "body-02",
  "productive-heading-01": "heading-compact-01",
  "productive-heading-02": "heading-compact-02",
  "expressive-heading-01": "heading-01",
  "expressive-heading-02": "heading-02",
  "productive-heading-03": "heading-03",
  "productive-heading-04": "heading-04",
  "productive-heading-05": "heading-05",
  "productive-heading-06": "heading-06",
  "productive-heading-07": "heading-07",
  "active-danger": "button-danger-active",
  "active-light-ui": "layer-active-02",
  "active-primary": "button-primary-active",
  "active-secondary": "button-secondary-active",
  "active-tertiary": "button-tertiary-active",
  "hover-danger": "button-danger-hover",
  "hover-light-ui": "layer-hover-02",
  "hover-primary": "button-primary-hover",
  "hover-primary-text": "link-primary-hover",
  "hover-secondary": "button-secondary-hover",
  "hover-selected-ui": "background-selected-hover",
  "hover-tertiary": "button-tertiary-hover",
  "hover-ui": "background-hover",
  "icon-01": "icon-primary",
  "icon-02": "icon-secondary",
  "icon-03": "icon-on-color",
  "interactive-01": "background-brand",
  "interactive-02": "button-secondary",
  "interactive-03": "button-tertiary",
  "interactive-04": "border-interactive",
  "link-01": "link-primary",
  "link-02": "link-secondary",
  "overlay-01": "overlay",
  "selected-light-ui": "layer-selected-02",
  "skeleton-01": "skeleton-background",
  "skeleton-02": "skeleton-element",
  "support-01": "support-error",
  "support-02": "support-success",
  "support-03": "support-warning",
  "support-04": "support-info",
  "text-01": "text-primary",
  "text-02": "text-secondary",
  "text-03": "text-placeholder",
  "text-04": "text-on-color",
  "text-05": "text-helper",
  "text-error": "text-error",
  "hover-row": "layer-hover-01",
  "ui-01": "layer-01",
  "ui-02": "layer-02",
  "ui-03": "layer-accent-01",
  "ui-04": "border-subtle-01",
  "ui-05": "border-inverse",
  "carbon--spacing-01": "spacing-01",
  "carbon--spacing-02": "spacing-02",
  "carbon--spacing-03": "spacing-03",
  "carbon--spacing-04": "spacing-04",
  "carbon--spacing-05": "spacing-05",
  "carbon--spacing-06": "spacing-06",
  "carbon--spacing-07": "spacing-07",
  "carbon--spacing-08": "spacing-08",
  "carbon--spacing-09": "spacing-09",
  "carbon--spacing-10": "spacing-10",
  "carbon--spacing-11": "spacing-11",
  "carbon--spacing-12": "spacing-12",
  "carbon--spacing-13": "spacing-13",
  "carbon--spacing": "spacing",
  "carbon--layout-01": "spacing-05",
  "carbon--layout-02": "spacing-06",
  "carbon--layout-03": "spacing-07",
  "carbon--layout-04": "spacing-09",
  "carbon--layout-05": "spacing-10",
  "carbon--layout-06": "spacing-12",
  "carbon--layout-07": "spacing-13",
  "carbon--layout": "spacing",
  "layout-01": "spacing-05",
  "layout-02": "spacing-06",
  "layout-03": "spacing-07",
  "layout-04": "spacing-09",
  "layout-05": "spacing-10",
  "layout-06": "spacing-12",
  "layout-07": "spacing-13"
};

// Rule entry
export function migrateCarbonPkg(options: any) {
  return async (tree: Tree) => {

    const workspace = await getWorkspace(tree);
    const project = workspace.projects.get(options.project);

    // console.log('srcRoot is', project?.sourceRoot);
    if (project?.sourceRoot) {
      // Get directory to start searching for the templates in
      const srcTree = tree.getDir(project.sourceRoot);

      // Visit the asset directory that is parellel to src directory. The name of the file should be `variables.scss`. Replace @import statements to `@use`
      const assetsPath = project.sourceRoot.replace('/src', '/assets/variables.scss');
      if (tree.exists(assetsPath)) {
        const fileBuffer = tree.read(assetsPath);
        if (fileBuffer) {
          const fileContent = fileBuffer.toString('utf-8');
          // Replace all @import statements with @use
          const importRegex = /@import\s+(['"])(.*?)\1\s*;?/g;
          const updatedContent = fileContent.replace(importRegex, '@use "$2" as *');
          tree.overwrite(assetsPath, updatedContent);
        }
      }

      srcTree.visit(filePath => {
        // Check only component scss files
        if (filePath.endsWith('.scss')) {
          const fileBuffer = tree.read(filePath);
          if (fileBuffer) {
            const fileContent = fileBuffer.toString('utf-8');

            Object.keys(importReplacementMap).forEach(key => {
              // Match @import 'variables' or @import "variables" with optional semicolon
              const importRegex = new RegExp(`@import\\s+(['"])${key}\\0\\s*;?`, 'g');

              if (importRegex.test(fileContent)) {
                // Replace with new @use syntax
                const updatedContent = fileContent.replace(importRegex, `@use 'variables' as *`);
                tree.overwrite(filePath, updatedContent);
              }
            });


            Object.keys(tokenReplacementMap).forEach(key => {
              const tokenRegex = new RegExp(`$${key}\\0`, 'g');
              if (tokenRegex.test(fileContent)) {
                const updatedContent = fileContent.replace(tokenRegex, `$${tokenReplacementMap[key]}`);
                tree.overwrite(filePath, updatedContent);
              }
            });
          }
        }
      });
    }

    return tree;
  };
}


/**
1. Search for assets & use the new syntax
2. Update styles.scss
3. Update all *.component.scss files to `@use 'variables' as *` if `@import 'variables'` exist
 */