const fs = require('fs');
const path = 'client/src/backend/AdminDashboardPage.css';
let css = fs.readFileSync(path, 'utf8');
let lines = css.split('\n');
let keep = [];
let skipBlock = false;
let braceCount = 0;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  
  if (skipBlock) {
    let openBraces = (line.match(/\{/g) || []).length;
    let closeBraces = (line.match(/\}/g) || []).length;
    braceCount += openBraces - closeBraces;
    if (braceCount <= 0) {
      skipBlock = false;
      braceCount = 0;
    }
    continue;
  }

  if (line.match(/^\s*\.ao-/) || line.match(/^\s*\.ap-overview/) || line.match(/^\s*\.ap-body--overview/)) {
    let peek = line;
    let j = i;
    while (!peek.includes('{') && j < lines.length - 1) {
      j++;
      peek += lines[j];
    }
    if (peek.includes('.ao-') || peek.includes('.ap-overview') || peek.includes('.ap-body--overview')) {
      skipBlock = true;
      let openBraces = (peek.match(/\{/g) || []).length;
      let closeBraces = (peek.match(/\}/g) || []).length;
      braceCount = openBraces - closeBraces;
      i = j;
      if (braceCount <= 0) skipBlock = false;
      continue;
    }
  }

  if (line.match(/\/\*.*Overview.*\*\//gi)) continue;

  keep.push(line);
}

fs.writeFileSync(path, keep.join('\n'), 'utf8');
console.log('Removed ' + (lines.length - keep.length));
