mv ../README.md ../README_backup.md
cp ../docs/marketplace/EXTENSION.md ../README.md
vsce publish
rm ../README.md
mv ../README_backup.md ../README.md