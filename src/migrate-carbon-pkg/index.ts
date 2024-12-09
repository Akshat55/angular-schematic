import * as ts from 'typescript';
import { DirEntry, Tree } from '@angular-devkit/schematics';
import { strings } from '@angular-devkit/core';
import { parseFragment } from 'parse5';
import { getWorkspace } from '@schematics/angular/utility/workspace';
import {
  Change,
  InsertChange,
  RemoveChange
} from '@schematics/angular/utility/change';
import {
  addImportToModule,
  findNodes,
  isImported
} from '@schematics/angular/utility/ast-utils';
import { getSourceNodes } from '@schematics/angular/utility/ast-utils'
import { Element } from 'parse5/dist/tree-adapters/default';


// Rule entry
export function migrateCarbonPkg(options: any) {
  return async (tree: Tree) => {

    const workspace = await getWorkspace(tree);
    const project = workspace.projects.get(options.project);

    // console.log('srcRoot is', project?.sourceRoot);
    if (project?.sourceRoot) {
      // Get directory to start searching for the templates in
      const srcTree = tree.getDir(project.sourceRoot);


      // Modify all HTML files in the tree
      srcTree.visit(filePath => {
        // Check only component html files
        if (filePath.endsWith('component.html')) {
          const fileBuffer = tree.read(filePath);
          if (fileBuffer) {
            const fileContent = fileBuffer.toString('utf-8');


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