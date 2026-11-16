# Writeups

One Markdown file per lab, e.g. `writeups/lame.md`. Link it from `data/htb-extras.json`:

```json
{ "machine-1": { "writeup": "writeups/lame.md", "video": "https://www.youtube.com/watch?v=..." } }
```

The key is the lab's ID: open the lab on the tree and copy what comes after `#` in the address bar.

Supported Markdown: headings, bold, italic, `inline code`, fenced code blocks, links, images
(put them next to the writeup and link them relatively), lists, blockquotes and `---` rules.

Hack The Box only allows published solutions for retired content, so the tree hides writeups and
videos for anything still active and shows "Writeup available after retirement" instead.
