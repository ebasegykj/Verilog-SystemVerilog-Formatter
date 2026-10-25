export interface FormatOptions {
  indentSize: number;
  alignPorts: boolean;
  alignAssign: boolean;
}

const OPEN_KW = new Set([
  'module', 'begin', 'case', 'casex', 'casez', 'function', 'task',
  'package', 'interface', 'generate', 'primitive', 'table', 'config',
  'specify', 'class', 'clocking', 'covergroup', 'property', 'sequence',
  'program', 'checker',
]);

const CLOSE_KW = new Set([
  'endmodule', 'end', 'endcase', 'endfunction', 'endtask',
  'endpackage', 'endinterface', 'endgenerate', 'endprimitive',
  'endtable', 'endconfig', 'endspecify', 'endclass', 'endclocking',
  'endgroup', 'endproperty', 'endsequence', 'endprogram', 'endchecker',
]);

const CTRL_KW = new Set([
  'if', 'else', 'while', 'for', 'case', 'casex', 'casez', 'repeat',
  'fork', 'join', 'join_any', 'join_none', 'return', 'break', 'continue',
  'initial', 'always', 'function', 'task', 'module', 'begin', 'end',
  'endcase', 'endfunction', 'endtask', 'endmodule', 'endpackage',
  'endinterface', 'endgenerate', 'endspecify', 'endclass', 'package',
  'interface', 'generate', 'class', 'wait', 'disable', 'deassign',
  'force', 'release', 'specify', 'endspecify', 'primitive', 'table',
  'config', 'covergroup', 'property', 'sequence', 'program', 'checker',
  'clocking', 'assert', 'assume', 'cover', 'restrict', 'final',
]);

function isWordChar(c: string): boolean {
  return /[A-Za-z0-9_$]/.test(c);
}

function extractKeywords(line: string): string[] {
  const kws: string[] = [];
  let i = 0;
  const n = line.length;
  let inStr = false;
  while (i < n) {
    const c = line[i];
    if (!inStr && c === '/' && line[i + 1] === '/') break;
    if (!inStr && c === '/' && line[i + 1] === '*') {
      let j = i + 2;
      while (j < n && !(line[j] === '*' && line[j + 1] === '/')) j++;
      i = j + 2;
      continue;
    }
    if (c === '"') { inStr = !inStr; i++; continue; }
    if (isWordChar(c)) {
      let j = i;
      while (j < n && isWordChar(line[j])) j++;
      const word = line.slice(i, j);
      if (OPEN_KW.has(word) || CLOSE_KW.has(word)) kws.push(word);
      i = j;
      continue;
    }
    i++;
  }
  return kws;
}

function splitTrailingComment(line: string): { code: string; comment: string } {
  let inStr = false;
  for (let i = 0; i < line.length - 1; i++) {
    const c = line[i];
    if (c === '"') inStr = !inStr;
    else if (!inStr && c === '/' && line[i + 1] === '/') {
      return { code: line.slice(0, i), comment: line.slice(i) };
    }
  }
  return { code: line, comment: '' };
}

function normalizeKeywords(code: string): string {
  let s = code;
  s = s.replace(/\balways\s*@\s*\(/g, 'always @(');
  s = s.replace(/\bif\s*\(/g, 'if (');
  s = s.replace(/\bcase\s*\(/g, 'case (');
  s = s.replace(/\bcasex\s*\(/g, 'casex (');
  s = s.replace(/\bcasez\s*\(/g, 'casez (');
  s = s.replace(/\bfor\s*\(/g, 'for (');
  s = s.replace(/\bwhile\s*\(/g, 'while (');
  s = s.replace(/\brepeat\s*\(/g, 'repeat (');
  s = s.replace(/\)\s*begin\b/g, ') begin');
  s = s.replace(/;\s*begin\b/g, '; begin');
  return s;
}

function normalizeOperators(code: string): string {
  let s = code;
  const stash: string[] = [];
  const protectOps = ['===', '!==', '<=', '==', '!=', '>='];
  for (const op of protectOps) {
    const esc = op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s.replace(new RegExp(esc, 'g'), () => {
      const id = stash.length;
      stash.push(op);
      return `\x01${id}\x02`;
    });
  }
  s = s.replace(/(?<![<>])\s*=\s*/g, ' = ');
  const spaceOps = new Set(['<=', '==', '!=', '>=']);
  for (let i = 0; i < stash.length; i++) {
    const op = stash[i];
    if (spaceOps.has(op)) {
      s = s.replace(new RegExp(`\\s*\x01${i}\x02\\s*`, 'g'), ` ${op} `);
    } else {
      s = s.replace(new RegExp(`\x01${i}\x02`, 'g'), op);
    }
  }
  s = s.replace(/,\s*(?=\S)/g, ',');
  s = s.replace(/\{\s+/g, '{');
  s = s.replace(/\s+\}/g, '}');
  s = s.replace(/\(\s+/g, '(');
  s = s.replace(/\s*\|\|\s*/g, ' || ');
  s = s.replace(/\s*&&\s*/g, ' && ');
  s = s.replace(/(\S)\s*\+\s*(?=[(\w])/g, '$1 + ');
  s = s.replace(/(\S)\s*\*\s*(?=\S)/g, '$1 * ');
  s = s.replace(/([)\]\w])\s*-\s*(?=[(\w])/g, '$1 - ');
  s = s.replace(/(\S)\s*\/\s*(?=\S)/g, '$1 / ');
  s = s.replace(/(\S)\s*%\s*(?=\S)/g, '$1 % ');
  s = s.replace(/(\S)\s*<<<\s*(?=\S)/g, '$1 <<< ');
  s = s.replace(/(\S)\s*>>>\s*(?=\S)/g, '$1 >>> ');
  s = s.replace(/(\S)\s*(?<!<)<<(?![<])\s*(?=\S)/g, '$1 << ');
  s = s.replace(/(\S)\s*(?<!>)>>(?![>])\s*(?=\S)/g, '$1 >> ');
  s = s.replace(/(\S)\s*(?<!<)<(?![<=])\s*(?=\S)/g, '$1 < ');
  s = s.replace(/(\S)\s*(?<!>)>(?![>=])\s*(?=\S)/g, '$1 > ');
  s = s.replace(/([)\]\w'])\s*([&|^])\s*(?=[(\w'])/g, '$1 $2 ');
  s = s.replace(/\s+\)/g, ')');
  s = s.replace(/\s+;/g, ';');
  const bitColons: string[] = [];
  s = s.replace(/\[([^\]]*)\]/g, (m) => {
    if (m.includes(':')) {
      const id = bitColons.length;
      bitColons.push(m);
      return `\x05${id}\x06`;
    }
    return m;
  });
  s = s.replace(/\s*\?\s*/g, ' ? ');
  if (s.includes('?')) {
    s = s.replace(/\s*:\s*(?=\S)/g, ' : ');
  }
  s = s.replace(/\x05(\d+)\x06/g, (_, id) => bitColons[parseInt(id)]);
  return s;
}

type LineType = 'port_decl' | 'signal_decl' | 'assign_like' | 'instance_port' | 'instance_decl' | 'other';

interface LineInfo {
  indent: number;
  absIndent?: number;
  code: string;
  comment: string;
  type: LineType;
  skip: boolean;
  raw: string;
}

function hasAssignEqual(c: string): boolean {
  const masked = c.replace(/<=|>=|==|!=|<<|>>/g, '  ');
  return /=(?!=)/.test(masked);
}

function classifyLine(code: string, inModuleHeader: boolean): LineType {
  const c = code.trim();
  if (!c) return 'other';
  if (/^\.\s*\w+/.test(c)) return 'instance_port';
  if (!inModuleHeader && /\(\s*$/.test(c)) {
    const fw = (c.match(/^(\w+)/) || ['', ''])[1];
    if (fw && !CTRL_KW.has(fw)) return 'instance_decl';
    if (/^\)\s*\w+/.test(c)) return 'instance_decl';
  }
  if (inModuleHeader && /^(input|output|inout)\b/.test(c)) return 'port_decl';
  if (/^(reg|wire)\b/.test(c) && /;\s*$/.test(c) && !/<=/.test(c) && !hasAssignEqual(c)) {
    return 'signal_decl';
  }
  if (/^assign\b/.test(c)) return 'assign_like';
  const firstWord = (c.match(/^(\w+)/) || ['', ''])[1];
  if (CTRL_KW.has(firstWord)) return 'other';
  if (/<=/.test(c) || hasAssignEqual(c)) return 'assign_like';
  return 'other';
}

function alignAssignLike(group: LineInfo[]): LineInfo[] {
  const parsed = group.map(li => {
    const c = li.code;
    const m = c.match(/^(.*?)\s*(<=)\s*(.*)$/);
    if (m) return { prefix: m[1].trimEnd(), op: '<=', suffix: m[3].trim() };
    const masked = c.replace(/<=|>=|==|!=|<<|>>/g, '\x03\x03');
    const idx = masked.indexOf('=');
    if (idx >= 0 && masked[idx + 1] !== '=') {
      return { prefix: c.slice(0, idx).trimEnd(), op: '=', suffix: c.slice(idx + 1).trimStart() };
    }
    return null;
  });
  const valid = parsed.filter(Boolean) as { prefix: string; op: string; suffix: string }[];
  if (valid.length === 0) return group;
  const maxPrefix = Math.max(...valid.map(p => p.prefix.length));
  return group.map((li, idx) => {
    const p = parsed[idx];
    if (!p) return li;
    return { ...li, code: p.prefix + ' '.repeat(maxPrefix - p.prefix.length + 1) + p.op + ' ' + p.suffix };
  });
}

function alignPortDecl(group: LineInfo[]): LineInfo[] {
  const parsed = group.map(li => {
    const m = li.code.match(/^(input|output|inout)\s+(reg|wire)?\s*(\[[^\]]*\])?\s*(\w+)\s*,?\s*$/);
    if (!m) return null;
    return {
      dir: m[1],
      type: m[2] || '',
      width: (m[3] || '').replace(/\s+/g, ''),
      name: m[4],
      hasComma: /,\s*$/.test(li.code),
    };
  });
  const valid = parsed.filter(Boolean) as { dir: string; type: string; width: string; name: string; hasComma: boolean }[];
  if (valid.length === 0) return group;
  const maxDir = Math.max(...valid.map(p => p.dir.length));
  const maxType = Math.max(...valid.map(p => p.type.length));
  const maxWidth = Math.max(...valid.map(p => p.width.length));
  const rebuilt = group.map((li, idx) => {
    const p = parsed[idx];
    if (!p) return li;
    const dir = p.dir + ' '.repeat(maxDir - p.dir.length);
    const type = p.type + ' '.repeat(maxType - p.type.length);
    const width = p.width + ' '.repeat(maxWidth - p.width.length);
    let code = dir;
    if (maxType > 0) code += ' ' + type;
    if (maxWidth > 0) code += ' ' + width;
    code += ' ' + p.name;
    if (p.hasComma) code += ',';
    return { ...li, code };
  });
  const maxCodeLen = Math.max(...rebuilt.map(li => li.code.length));
  return rebuilt.map(li => {
    if (li.comment && li.code.length < maxCodeLen) {
      return { ...li, code: li.code + ' '.repeat(maxCodeLen - li.code.length) };
    }
    return li;
  });
}

function alignSignalDecl(group: LineInfo[]): LineInfo[] {
  const parsed = group.map(li => {
    const m = li.code.match(/^(reg|wire)\s+(\[[^\]]*\])?\s*(\w+(?:\s*,\s*\w+)*)\s*;\s*$/);
    if (!m) return null;
    return { type: m[1], width: (m[2] || '').replace(/\s+/g, ''), name: m[3].replace(/\s*,\s*/g, ',') };
  });
  const valid = parsed.filter(Boolean) as { type: string; width: string; name: string }[];
  if (valid.length === 0) return group;
  const maxType = Math.max(...valid.map(p => p.type.length));
  const maxWidth = Math.max(...valid.map(p => p.width.length));
  const rebuilt = group.map((li, idx) => {
    const p = parsed[idx];
    if (!p) return li;
    const type = p.type + ' '.repeat(maxType - p.type.length);
    const width = p.width + ' '.repeat(maxWidth - p.width.length);
    let code = type;
    if (maxWidth > 0) code += ' ' + width;
    code += ' ' + p.name + ';';
    return { ...li, code };
  });
  const maxCodeLen = Math.max(...rebuilt.map(li => li.code.length));
  return rebuilt.map(li => {
    if (li.comment && li.code.length < maxCodeLen) {
      return { ...li, code: li.code + ' '.repeat(maxCodeLen - li.code.length) };
    }
    return li;
  });
}

function alignInstancePort(group: LineInfo[]): LineInfo[] {
  const parsed = group.map(li => {
    const m = li.code.match(/^\.\s*(\w+)\s*\(\s*(.*?)\s*\)\s*,?\s*$/);
    if (!m) return null;
    return { port: m[1], sig: m[2], hasComma: /,\s*$/.test(li.code) };
  });
  const valid = parsed.filter(Boolean) as { port: string; sig: string; hasComma: boolean }[];
  if (valid.length === 0) return group;
  const maxPort = Math.max(...valid.map(p => p.port.length));
  const rebuilt = group.map((li, idx) => {
    const p = parsed[idx];
    if (!p) return li;
    const port = p.port + ' '.repeat(maxPort - p.port.length);
    let code = '.' + port + ' (' + p.sig + ')';
    if (p.hasComma) code += ',';
    return { ...li, code };
  });
  const maxCodeLen = Math.max(...rebuilt.map(li => li.code.length));
  return rebuilt.map(li => {
    if (li.comment && li.code.length < maxCodeLen) {
      return { ...li, code: li.code + ' '.repeat(maxCodeLen - li.code.length) };
    }
    return li;
  });
}

function formatInstanceBlock(lines: LineInfo[], start: number, end: number, indentSize: number): void {
  const code = lines[start].code.trim();
  const baseSpaces = lines[start].indent * indentSize;
  const hasParam = /#\s*\(/.test(code);

  const setPortIndent = (portIndent: number) => {
    for (let k = start + 1; k < end; k++) {
      if (lines[k].type === 'instance_port' && lines[k].code.trim()) lines[k].absIndent = portIndent;
      else if (!lines[k].code.trim() && lines[k].comment) lines[k].absIndent = portIndent;
    }
  };
  const setEndIndent = (portIndent: number, col: number) => {
    if (lines[end].type === 'instance_port') lines[end].absIndent = portIndent;
    else lines[end].absIndent = col;
  };

  if (!hasParam) {
    const m = code.match(/^(\w+)\s+(\w+)\s*\(\s*$/);
    if (!m) return;
    const modName = m[1];
    const instName = m[2];
    const instNameCol = baseSpaces + modName.length + 2;
    lines[start].code = modName + '  ' + instName + ' (';
    setPortIndent(instNameCol + 3);
    setEndIndent(instNameCol + 3, instNameCol);
  } else {
    const m1 = code.match(/^(\w+)\s*#\s*\(\s*$/);
    if (m1) {
      const modName = m1[1];
      const hashCol = baseSpaces + modName.length + 1;
      const parenEndCol = baseSpaces + modName.length + 3;
      lines[start].code = modName + ' #(';
      const paramIndent = parenEndCol + 2;
      let instLine2 = -1;
      for (let k = start + 1; k < end; k++) {
        if (lines[k].type === 'instance_decl' && lines[k].code.trim()) { instLine2 = k; break; }
      }
      if (instLine2 >= 0) {
        const m2 = lines[instLine2].code.trim().match(/^(?:\)\s*)?(\w+)\s*\(\s*$/);
        if (m2) {
          const instName2 = m2[1];
          const hasCloseParen = /^\)/.test(lines[instLine2].code.trim());
          if (!hasCloseParen && instLine2 > start + 1) {
            const lastParam = lines[instLine2 - 1];
            if (lastParam.type === 'instance_port' && /\)\s*\)\s*$/.test(lastParam.code.trim())) {
              lastParam.code = lastParam.code.trim().replace(/\)\s*\)\s*$/, ')');
            }
          }
          lines[instLine2].code = ') ' + instName2 + ' (';
          lines[instLine2].absIndent = hashCol;
        }
      }
      setPortIndent(paramIndent);
      setEndIndent(paramIndent, hashCol);
    } else {
      const mC = code.match(/^(\w+)\s*#\s*\((.*?)\)\s+(\w+)\s*\(\s*$/);
      if (!mC) return;
      const modName = mC[1];
      const param = mC[2];
      const instName = mC[3];
      const instNameCol = baseSpaces + modName.length + 1 + 1 + 1 + param.length + 1 + 2;
      const portIndent = baseSpaces + modName.length + 6;
      lines[start].code = modName + ' #(' + param + ')  ' + instName + ' (';
      setPortIndent(portIndent);
      setEndIndent(portIndent, instNameCol);
    }
  }
}

function normalizeParamPort(param: string): string {
  return param.replace(/\.\s*(\w+)\s*\(/g, '.$1 (');
}

function splitInstanceOneline(lines: LineInfo[]): void {
  let i = 0;
  while (i < lines.length) {
    const li = lines[i];
    if (li.type !== 'instance_decl' || !li.code.trim()) { i++; continue; }
    const code = li.code.trim();
    const mC = code.match(/^(\w+)\s*#\s*\((.*?)\)\s+(\w+)\s*\(\s*$/);
    if (!mC) { i++; continue; }
    if (!mC[2].trim()) {
      const modName0 = mC[1];
      const instName0 = mC[3];
      li.code = modName0 + ' #(';
      const closeInstLine: LineInfo = {
        indent: li.indent,
        code: ') ' + instName0 + ' (',
        comment: '',
        type: 'instance_decl',
        skip: false,
        raw: '',
      };
      lines.splice(i + 1, 0, closeInstLine);
      i += 2;
      continue;
    }
    const modName = mC[1];
    const param = mC[2];
    const instName = mC[3];
    li.code = modName + ' #(';
    const paramLine: LineInfo = {
      indent: li.indent,
      code: normalizeParamPort(param) + ')',
      comment: '',
      type: 'instance_port',
      skip: false,
      raw: '',
    };
    const instLine: LineInfo = {
      indent: li.indent,
      code: instName + ' (',
      comment: '',
      type: 'instance_decl',
      skip: false,
      raw: '',
    };
    lines.splice(i + 1, 0, paramLine, instLine);
    i += 3;
  }
}

function splitInstanceClose(lines: LineInfo[]): void {
  let i = 0;
  while (i < lines.length) {
    const li = lines[i];
    if (li.type === 'instance_port' && li.code.trim() && /;\s*$/.test(li.code.trim()) && li.code.trim().length > 2) {
      const code = li.code.trim();
      const portPart = code.slice(0, -2).trim();
      if (portPart && /^\./.test(portPart)) {
        li.code = portPart;
        const closeLine: LineInfo = {
          indent: li.indent,
          code: ');',
          comment: '',
          type: 'other',
          skip: false,
          raw: '',
        };
        lines.splice(i + 1, 0, closeLine);
        i += 2;
        continue;
      }
    }
    i++;
  }
}

function formatInstance(lines: LineInfo[], indentSize: number): void {
  let i = 0;
  while (i < lines.length) {
    if (lines[i].type === 'instance_decl' && lines[i].code.trim() && !/^\)/.test(lines[i].code.trim())) {
      let j = i;
      while (j < lines.length && !(/;\s*$/.test(lines[j].code.trim()) && /\)/.test(lines[j].code.trim()))) j++;
      if (j < lines.length) formatInstanceBlock(lines, i, j, indentSize);
      i = j + 1;
    } else {
      i++;
    }
  }
}

function normalizeInstancePort(lines: LineInfo[]): void {
  for (const li of lines) {
    if (li.type !== 'instance_port' || !li.code.trim()) continue;
    const m = li.code.match(/^\.\s*(\w+)\s*\(\s*([\s\S]*?)\)\s*([\s\S]*)$/);
    if (!m) continue;
    const port = m[1];
    const sig = m[2].trim();
    const rest = m[3];
    li.code = '.' + port + ' (' + sig + ')' + rest;
  }
}

function alignPass(lines: LineInfo[]): LineInfo[] {
  const result: LineInfo[] = lines.slice();
  let i = 0;
  while (i < lines.length) {
    const li = lines[i];
    if (li.skip || li.type === 'other' || !li.code.trim()) {
      i++;
      continue;
    }
    const crossGap = li.type === 'port_decl';
    const crossComment = li.type === 'instance_port';
    const groupIdx: number[] = [];
    let j = i;
    while (j < lines.length) {
      const lj = lines[j];
      if (lj.skip) break;
      if (lj.type === li.type && lj.code.trim()) {
        groupIdx.push(j);
        j++;
      } else if (crossGap && !lj.code.trim()) {
        j++;
      } else if (crossComment && !lj.code.trim() && lj.comment) {
        j++;
      } else {
        break;
      }
    }
    if (groupIdx.length > 1) {
      const group = groupIdx.map(idx => result[idx]);
      let aligned: LineInfo[];
      switch (li.type) {
        case 'port_decl': aligned = alignPortDecl(group); break;
        case 'signal_decl': aligned = alignSignalDecl(group); break;
        case 'assign_like': aligned = alignAssignLike(group); break;
        case 'instance_port': aligned = alignInstancePort(group); break;
        default: aligned = group;
      }
      groupIdx.forEach((idx, k) => { result[idx] = aligned[k]; });
    }
    i = j;
  }
  return result;
}

export function formatVerilog(text: string, opts: FormatOptions): string {
  const lines = text.split(/\r?\n/);
  const infos: LineInfo[] = [];
  let level = 0;
  let inBlockComment = false;
  let inModuleHeader = false;

  for (const rawLine of lines) {
    const entersBlock = inBlockComment;
    let hadBlockStart = false;
    let hadBlockEnd = false;
    {
      let i = 0;
      let inStr = false;
      let bc: boolean = inBlockComment;
      while (i < rawLine.length) {
        const c = rawLine[i];
        if (c === '"') { inStr = !inStr; i++; continue; }
        if (!inStr && c === '/' && rawLine[i + 1] === '/') break;
        if (!inStr && c === '/' && rawLine[i + 1] === '*') {
          if (!bc) { bc = true; hadBlockStart = true; }
          i += 2; continue;
        }
        if (!inStr && c === '*' && rawLine[i + 1] === '/') {
          if (bc) { bc = false; hadBlockEnd = true; }
          i += 2; continue;
        }
        i++;
      }
      inBlockComment = bc;
    }

    if (entersBlock || hadBlockStart || hadBlockEnd) {
      infos.push({ indent: 0, code: '', comment: '', type: 'other', skip: true, raw: rawLine });
      continue;
    }

    const { code: rawCode, comment } = splitTrailingComment(rawLine);
    let code = rawCode.trim();

    const firstTokRaw = (code.match(/^(\w+)/) || ['', ''])[1];
    if (firstTokRaw === 'module') inModuleHeader = true;
    if (inModuleHeader && /^\);/.test(code)) inModuleHeader = false;

    if (!code) {
      infos.push({ indent: level, code: '', comment, type: 'other', skip: false, raw: rawLine });
      continue;
    }

    const kws = extractKeywords(code);
    const firstTok = kws.length > 0 ? kws[0] : null;
    const startsWithClose = firstTok ? CLOSE_KW.has(firstTok) : false;
    const indent = startsWithClose ? level - 1 : level;

    code = normalizeKeywords(code);
    code = normalizeOperators(code);

    let delta = 0;
    for (const k of kws) {
      if (OPEN_KW.has(k)) delta++;
      else if (CLOSE_KW.has(k)) delta--;
    }
    level += delta;
    if (level < 0) level = 0;

    const type = classifyLine(code, inModuleHeader);
    infos.push({ indent: Math.max(0, indent), code, comment, type, skip: false, raw: rawLine });
  }

  splitInstanceOneline(infos);
  splitInstanceClose(infos);
  formatInstance(infos, opts.indentSize);
  normalizeInstancePort(infos);
  const aligned = alignPass(infos);

  return aligned.map(li => {
    if (li.skip) return li.raw;
    const indentStr = li.absIndent != null ? ' '.repeat(Math.max(0, li.absIndent)) : ' '.repeat(Math.max(0, li.indent) * opts.indentSize);
    if (!li.code) {
      return li.comment ? indentStr + li.comment.trim() : '';
    }
    let line = indentStr + li.code;
    if (li.comment) line += '  ' + li.comment.trim();
    return line;
  }).join('\n');
}