import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLessonProgress, normaliseCourseLessons, setLessonCompletion } from '../src/domain/memberLearningPolicy.js';
const lessons=[{id:'welcome',title:'Welcome'},{id:'faith',title:'Foundations of faith'}];
test('normalises lessons and limits exposed lesson fields',()=>assert.deepEqual(normaliseCourseLessons([{id:'a',title:' Intro ',secret:'hidden'}]),[{id:'a',title:'Intro',description:''}]));
test('calculates unique progress only for lessons in the course',()=>{const p=calculateLessonProgress(lessons,['welcome','welcome','foreign']);assert.equal(p.progressPercent,50);assert.deepEqual(p.completedLessonIds,['welcome']);});
test('members can complete and reopen their own course lessons only',()=>{const done=setLessonCompletion(lessons,[],'welcome',true);assert.equal(done.progressPercent,50);assert.equal(setLessonCompletion(lessons,done.completedLessonIds,'welcome',false).progressPercent,0);assert.equal(setLessonCompletion(lessons,[],'other-course',true).valid,false);});
test('empty courses have zero progress',()=>assert.equal(calculateLessonProgress([],['x']).progressPercent,0));
