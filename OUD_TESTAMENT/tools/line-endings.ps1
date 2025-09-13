$ErrorActionPreference = 'stop'
set-location 'e:\the101game'

# schrijf .gitattributes
$rules = @'
* text=auto

# web-assets altijd lf
*.html text eol=lf
*.css  text eol=lf
*.js   text eol=lf
*.srt  text eol=lf
*.spec text eol=lf

# windows-scripts crlf
*.ps1  text eol=crlf
'@
set-content -literalpath '.gitattributes' -value $rules -encoding utf8

# renormalize alle files naar de gewenste endings
git add --renormalize .
git commit -m 'chore(repo): add .gitattributes and renormalize line endings'
git pull --rebase
git push
write-host 'line endings normalized.'
