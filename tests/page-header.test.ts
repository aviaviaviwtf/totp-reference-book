import test from 'node:test';
import assert from 'node:assert/strict';
import {daySlots} from '../lib/totp.ts';
import {transitionLabel} from '../lib/page-header.ts';
test('clock-change labels describe skipped and repeated ranges in both clock formats',()=>{
 assert.equal(transitionLabel(daySlots('2027-01-15','America/New_York'),'12'),'');
 assert.equal(transitionLabel(daySlots('2027-03-14','America/New_York'),'12'),'DST FORWARD / 02:00 AM -> 03:00 AM / 60 minutes skipped');
 assert.equal(transitionLabel(daySlots('2027-11-07','America/New_York'),'12'),'DST BACK / 02:00 AM -> 01:00 AM / 60 minutes repeated; columns marked first / second');
 assert.equal(transitionLabel(daySlots('2027-04-04','Australia/Lord_Howe'),'24'),'DST BACK / 02:00 -> 01:30 / 30 minutes repeated; columns marked first / second');
});
