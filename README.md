# Verilog/SystemVerilog Formatter

就一个功能：手动格式化
格式化verilog/SystemVerilog：缩进，关键字间距，操作符间距，端口/信号/实例对齐。

Format `.v`/`.sv` files: indent, keyword spacing, operator spacing, port/signal/instance alignment.

## Features

- Indent (configurable size, default 2)
- Keyword spacing: `if(`/`case(` → `if (`/`case (`
- Operator spacing: `<=`/`=`/`==`/`!=` aligned, `<=` column alignment in always blocks
- Port declaration alignment (direction/type/width/name columns, comma follows name)
- Signal definition `wire`/`reg` alignment (type/width/name columns)
- Instance port `.port (sig),` alignment, param/instance indent
- Parameter / localparam `=` alignment
- Comment preservation (line `//` and block `/* */` kept in place)
- Module instance unified: `#(` multi-line params, `) inst_name (` close+name same line

## Usage
右键单击 → **格式化文档** 

Open a `.v`/`.sv` file → Right-click → **Format Document** (or `Shift+Alt+F`).


## Configuration
没有设置选项安装即用
| Key | Default | Description |
|-----|---------|-------------|
| `vFormatter.indentSize` | 2 | Spaces per indent level |
| `vFormatter.alignPorts` | false | (reserved) |
| `vFormatter.alignAssign` | false | (reserved) |


## Install from .vsix

安装

应用商店搜索gykjw 安装即可

search for gykjw in the app store and install it

> gykjwrq@163.com by@RhycWu
