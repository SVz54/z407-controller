import {test} from 'node:test';
import assert from 'node:assert/strict';
import {actionFromPath} from '../docs/actions.mjs';
test('recognises hosted redirects and existing NFC links in both directions',()=>{
 for(const direction of ['up','down'])for(const suffix of ['', '.html', '/', '.html/'])assert.equal(actionFromPath(`/bass-${direction}${suffix}`),direction);
});
test('ordinary opening and unknown paths never trigger bass',()=>{
 for(const path of ['/', '/index.html','/bass-other','/bass-up-extra'])assert.equal(actionFromPath(path),null);
});

test('GitHub project paths support both NFC directions',()=>{for(const direction of ['up','down'])assert.equal(actionFromPath(`/z407-controller/bass-${direction}.html`),direction);});
