const workers=new Map<string,Promise<string>>();
export function loadWorker(url:string){
 // Development modules need their HTTP base for relative imports.
 if(import.meta.env.DEV)return Promise.resolve(url);
 const cached=workers.get(url);if(cached)return cached;
 const request=(async()=>{
  const response=await fetch(url);if(!response.ok)throw Error('Generation tools could not be loaded.');
  return URL.createObjectURL(new Blob([await response.text()],{type:'text/javascript'}));
 })();
 workers.set(url,request);
 void request.catch(()=>{if(workers.get(url)===request)workers.delete(url);});
 return request;
}
