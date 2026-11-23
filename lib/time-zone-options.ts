// Some browsers still expose these former city names. They are aliases, not
// separate locations. Keep other locations even when their offsets match.
// https://unicode.org/reports/tr35/ (time-zone identifier aliases)
const cityAliases:Record<string,string>={'Asia/Calcutta':'Asia/Kolkata','Asia/Katmandu':'Asia/Kathmandu'};
const currentCityZone=(zone:string)=>cityAliases[zone]??zone;
export function browserTimeZone(){
 try{
  const zone=new Intl.DateTimeFormat().resolvedOptions().timeZone;
  if(!zone)return 'UTC';
  new Intl.DateTimeFormat('en-US',{timeZone:zone}).format();
  return currentCityZone(zone);
 }catch{return 'UTC';}
}

export function timeZoneOptions(zones:string[],at=new Date()){
 const options=[...new Set(zones.map(currentCityZone))].map(value=>{
  const offset=new Intl.DateTimeFormat('en-US',{timeZone:value,timeZoneName:'shortOffset'}).formatToParts(at).find(part=>part.type==='timeZoneName')?.value??'GMT';
  const match=/^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/.exec(offset);
  if(!match)throw Error('Unrecognized time-zone offset');
  const minutes=(Number(match[2]??0)*60+Number(match[3]??0))*(match[1]==='-'?-1:1);
  const city=value==='UTC'?'UTC':value.split('/').at(-1)!.replaceAll('_',' ');
  const formatted=`UTC ${minutes<0?'-':'+'} ${String(Math.floor(Math.abs(minutes)/60)).padStart(2,'0')}:${String(Math.abs(minutes)%60).padStart(2,'0')}`;
  return {value,minutes,city,formatted};
 });
 return options.sort((a,b)=>a.minutes-b.minutes||a.city.localeCompare(b.city)||a.value.localeCompare(b.value)).map(option=>({value:option.value,label:`${option.formatted} – ${option.city}${options.some(other=>other.value!==option.value&&other.minutes===option.minutes&&other.city===option.city)?` (${option.value})`:''}`}));
}
