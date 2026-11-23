import type {PdfRequest} from '../pdf-request.ts';

// A workbench preview changes the source key, never the downloadable book's extent.
export function bookPdfRequest(input:Omit<PdfRequest,'full'>):PdfRequest{
 return {...input,full:true};
}
