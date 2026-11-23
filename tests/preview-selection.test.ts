import test from 'node:test';
import assert from 'node:assert/strict';
import {previewPages} from '../lib/workbench/preview-selection.ts';

test('a half-year preview selects actual title, details and ordinary timetable pages without shortening the full PDF',()=>{
 const pages=previewPages({start:'2026-01-01',end:'2026-06-30',zone:'UTC'},366);
 assert.deepEqual(pages.map(page=>page.number),[1,3,4,5,94,95,184,185,364,365]);
 assert.equal(pages.length,10);
 assert.match(pages.at(-1)!.label,/June 30, 2026 PM/);
});

test('New York preview includes the spring-forward AM and PM pages with original page numbers',()=>{
 const pages=previewPages({start:'2026-01-01',end:'2026-06-30',zone:'America/New_York'},366);
 assert.deepEqual(pages.map(page=>page.number),[1,3,4,5,136,137,184,185,364,365]);
 assert.match(pages[4].label,/March 8, 2026 AM.*clock change/);
});

test('half-hour DST changes are included and short specimen PDFs never select nonexistent pages',()=>{
 const pages=previewPages({start:'2026-07-01',end:'2026-12-31',zone:'Australia/Lord_Howe'},372);
 assert.deepEqual(pages.map(page=>page.number),[1,3,4,5,188,189,194,195,370,371]);
 assert.match(pages[6].label,/October 4, 2026 AM.*clock change/);
 assert.deepEqual(previewPages({start:'2026-07-01',end:'2026-12-31',zone:'UTC'},2).map(page=>page.number),[1,2]);
});

test('preview choices use supplied wording without changing the selected PDF pages',()=>{
 const labels={title:'Cover title page',details:'About this edition',page:'Sheet',clockChange:'DST transition'};
 const pages=previewPages({start:'2026-01-01',end:'2026-06-30',zone:'America/New_York'},366,labels);
 assert.deepEqual(pages.map(page=>page.number),[1,3,4,5,136,137,184,185,364,365]);
 assert.equal(pages[0].label,'Cover title page');assert.equal(pages[1].label,'About this edition');
 assert.equal(pages[4].label,'March 8, 2026 AM (DST transition)');
 assert.equal(previewPages(undefined,2,labels)[0].label,'Sheet 1');
});
