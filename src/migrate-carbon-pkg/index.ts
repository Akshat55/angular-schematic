import * as ts from 'typescript';
import { DirEntry, Tree } from '@angular-devkit/schematics';
import { getWorkspace } from '@schematics/angular/utility/workspace';
import { addImportToModule } from '@schematics/angular/utility/ast-utils';
import { InsertChange } from '@schematics/angular/utility/change';

const importReplacementMap: { [key: string]: string } = {
  'variables': 'variables',
  '@carbon/themes/scss/index': '@carbon/themes',
  '@carbon/themes/scss/themes': '@carbon/themes',
  '@carbon/type/scss/type': '@carbon/type',
  '@carbon/colors/scss/colors': '@carbon/colors',
  '@carbon/colors/scss/index': '@carbon/colors',
  '@carbon/layout/scss/layout': '@carbon/layout',
  'carbon-components/scss/globals/scss/typography': '@carbon/styles/scss/type',
  'carbon-components/scss/globals/scss/layout': '@carbon/styles/scss/spacing'
};

const tokenReplacementMap: { [key: string]: string } = {
  // Type
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
  // Mixins type
  "carbon--type-style": "type-style",
  "carbon--type-size": "type-size",
  "carbon--type-scale": "type-scale",
  "carbon--type-classes": "type-classs",
  "carbon--type-reset": "type-reset",
  "carbon--type-weight": "type-weight",
  // Theme
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
  // Layout
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
  "layout-07": "spacing-13",
  // Colors
  "carbon--gray-": "gray-",
  "carbon--white-": "white-",
  "carbon--red-": "red-",
  "carbon--purple-": "purple-",
  "carbon--blue-": "blue-",
  "carbon--green-": "green-",
  "carbon--magenta-": "magenta-",
  "carbon--orange-": "orange-",
  "carbon--teal-": "teal-",
  "carbon--yellow-": "yellow-",
  "carbon--black-": "black-",
  "carbon--warm-gray-": "warm-gray-",
  "carbon--cool-gray-": "cool-gray-",
  "ibm-color__white-": "white-",
  "ibm-color__red-": "red-",
  "ibm-color__gray-": "gray-",
  "ibm-color__green-": "green-",
  "ibm-color__blue-": "blue-",
  "ibm-color__cool-gray-": "cool-gray-",
  // Component specific customization token
  "danger-01": "red-60",
  "visited-link": "link-visited"
};

function getReplacementImport(original: string, useForward: boolean = false, noNamespace: boolean = false): string {
  let replacement = '';

  const keys = Object.keys(importReplacementMap);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const tokenRegex = new RegExp(`${key}`, 'gm');
    if (tokenRegex.test(original)) {
      replacement = importReplacementMap[key];
      i = keys.length;
    }
  };

  // Will need to look at it manually
  if (replacement === "") {
    return original;
  }

  return `${useForward ? '@forward' : '@use'} '${replacement}'${noNamespace ? ' as *' : ''};`;
}

// Visit the asset directory that is parellel to src directory. The name of the file should be `variables.scss`. 
// Replace @import statements to `@forward`
function replaceStylesInAssets(tree: Tree, assetsPath: string) {
  const assetDir = tree.getDir(assetsPath);
  assetDir.visit(filePath => {
    if (filePath.endsWith("variables.scss")) {
      const fileBuffer = tree.read(filePath);
      if (fileBuffer) {
        const fileContent = fileBuffer.toString('utf-8');
        // Replace all @import statements with @forward
        const importRegex = /@import\s+(['"])(.*?)\1\s*;?/g;
        if (importRegex.test(fileContent)) {
          const updatedContent = fileContent.replace(importRegex, (original, _) => {
            return getReplacementImport(original, true);
          });
          tree.overwrite(filePath, updatedContent);
        }
      }
    }
  });
}

function replaceTokens(srcTree: DirEntry, tree: Tree) {
  srcTree.visit(filePath => {
    // Check only component scss files
    if (filePath.endsWith('.scss')) {
      Object.keys(importReplacementMap).forEach(_ => {
        const fileBuffer = tree.read(filePath);
        if (fileBuffer) {
          const fileContent = fileBuffer.toString('utf-8');
          // Match @import 'variables' or @import "variables" with optional semicolon
          const importRegex = /@import\s+(['"])(.*?)\1\s*;?/g;

          if (importRegex.test(fileContent)) {
            // Replace with new @use syntax
            const updatedContent = fileContent.replace(importRegex, (original, _) => {
              return getReplacementImport(original, false, true);
            });
            tree.overwrite(filePath, updatedContent);
          }
        }
      });

      Object.keys(tokenReplacementMap).forEach(key => {
        const fileBuffer = tree.read(filePath);
        if (fileBuffer) {
          const fileContent = fileBuffer.toString('utf-8');
          const tokenRegex = new RegExp(`${key}`, 'gm');

          if (tokenRegex.test(fileContent)) {
            const updatedContent = fileContent.replace(tokenRegex, `${tokenReplacementMap[key]}`);
            tree.overwrite(filePath, updatedContent);
          }
        }
      });
    }
  });
}

function replaceCarbonPrefix(srcTree: DirEntry, tree: Tree) {
  srcTree.visit(filePath => {
    // Check only component scss files
    if (filePath.endsWith('.scss') || filePath.endsWith(".html")) {
      const fileBuffer = tree.read(filePath);
      if (fileBuffer) {
        const fileContent = fileBuffer.toString('utf-8');
        const prefixRegex = new RegExp(`bx--`, 'g');

        if (prefixRegex.test(fileContent)) {
          const updatedContent = fileContent.replace(prefixRegex, `cds--`);
          tree.overwrite(filePath, updatedContent);
        }
      }
    }
  });
}

function importBucFeatureModule(srcTree: DirEntry, tree: Tree) {
  srcTree.visit(filePath => {
    if (filePath.endsWith('app.module.ts')) {
      const sourceText = tree.read(filePath)?.toString('utf-8') || '';
      const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);

      const recorder = tree.beginUpdate(filePath);

      // Add IconModule to the imports array in the NgModule
      const moduleImportChange = addImportToModule(sourceFile, filePath, 'BucFeatureComponentsModule', '@buc/common-components');
      moduleImportChange.forEach(change => {
        if (change instanceof InsertChange) {
          recorder.insertLeft(change.pos, change.toAdd);
        }
      });

      tree.commitUpdate(recorder);
    }
  });
}

function importLayerModule(srcTree: DirEntry, tree: Tree) {
  srcTree.visit(filePath => {
    if (filePath.endsWith('app.module.ts')) {
      const sourceText = tree.read(filePath)?.toString('utf-8') || '';
      const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);

      const recorder = tree.beginUpdate(filePath);

      // Add IconModule to the imports array in the NgModule
      const moduleImportChange = addImportToModule(sourceFile, filePath, 'LayerModule', 'carbon-components-angular');
      moduleImportChange.forEach(change => {
        if (change instanceof InsertChange) {
          recorder.insertLeft(change.pos, change.toAdd);
        }
      });

      tree.commitUpdate(recorder);
    }

    if(filePath.endsWith('app.component.html')) {
      const fileBuffer = tree.read(filePath);
      if (fileBuffer) {
        const fileContent = fileBuffer.toString('utf-8');
        const placeholderRegex = new RegExp('\<ibm\-placeholder\>', 'g');
        const routerOutletWrapperRegex = new RegExp('class="app-body-content"');

        if (placeholderRegex.test(fileContent) && !fileContent.includes('<ibm-placeholder cdsLayer>')) {
          const updatedContent = fileContent.replace(placeholderRegex, `<ibm-placeholder cdsLayer>`);
          tree.overwrite(filePath, updatedContent);
        }

        if(routerOutletWrapperRegex.test(fileContent) && !fileContent.includes('class="app-body-content" cdsLayer')) {
          const updatedContent = fileContent.replace(routerOutletWrapperRegex, 'class="app-body-content" cdsLayer');
          tree.overwrite(filePath, updatedContent);
        }
      }
    }
  });
}

// Rule entry
export function migrateCarbonPkg(options: any) {
  return async (tree: Tree) => {

    const workspace = await getWorkspace(tree);
    const project = workspace.projects.get(options.project);

    if (project?.sourceRoot) {
      // Get directory to start searching for the templates in
      const srcTree = tree.getDir(project.sourceRoot);

      const isShared = project.sourceRoot.includes('-shared');
      const assetReplacement = isShared ? '/assets' : '/src/assets';

      // Replace content in assets dir
      const assetsPath = project.sourceRoot.replace('/src', assetReplacement);
      replaceStylesInAssets(tree, assetsPath);
      replaceTokens(tree.getDir(assetsPath), tree);
      replaceCarbonPrefix(tree.getDir(assetsPath), tree);

      // Replace content in src dir
      replaceTokens(srcTree, tree);
      replaceCarbonPrefix(srcTree, tree);

      if (!isShared) {
        importBucFeatureModule(srcTree, tree);
        importLayerModule(srcTree, tree);
      }
    }

    return tree;
  };
}
