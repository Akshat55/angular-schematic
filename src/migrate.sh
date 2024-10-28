#!/bin/bash

if [ "$#" -lt 1 ]; then
    echo "Usage $0 <directory> <command>"
    exit 1
fi

parent_dir=$1
shift
command="npm run ng -- generate /Users/akshatpatel/Desktop/angular-schematic:migrate-icon-pkg"

cd "$parent_dir"

# loop through each dierctory and run migration command
for dir in $parent_dir/packages/*; do
    # check if its a directory
    if [ -d "$dir" ]; then
        echo "Running command in: $dir"
        dir_name=$(basename "$dir")
        (eval "$command --project=\"$dir_name"\")
    fi
done
