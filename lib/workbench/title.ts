import glyphs from './title-glyphs.json' with {type:'json'};
const supported=new Set(glyphs);
export function titleIssue(title:string):'empty'|'length'|'characters'|null{
 if(!title.trim())return 'empty';
 if([...title].length>60)return 'length';
 if([...title].some(char=>!supported.has(char.codePointAt(0)!)||char.codePointAt(0)!<32))return 'characters';
 return null;
}
