mv README.md README_backup.md
cp docs/marketplace/EXTENSION.md README.md
cp -r docs/img img
vsce publish
rm README.md
mv README_backup.md README.md
rm -r img