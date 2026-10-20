// COLONIZATION — guardado por usuario en este computador (localStorage)
'use strict';
const Save=(()=>{
const K='colonization.';
function users(){try{return JSON.parse(localStorage.getItem(K+'users')||'[]');}catch(_){return [];}}
function addUser(n){n=(n||'').trim().slice(0,24);if(!n)return null;const u=users();if(u.indexOf(n)<0){u.push(n);localStorage.setItem(K+'users',JSON.stringify(u));}localStorage.setItem(K+'lastUser',n);return n;}
function lastUser(){try{return localStorage.getItem(K+'lastUser')||'';}catch(_){return '';}}
function key(user,mode){return K+'save.'+user+'.'+mode;}
function save(user,mode,state){try{localStorage.setItem(key(user,mode),JSON.stringify({t:Date.now(),state}));return true;}catch(e){console.warn('save failed',e);return false;}}
function load(user,mode){try{const s=localStorage.getItem(key(user,mode));return s?JSON.parse(s):null;}catch(_){return null;}}
function remove(user,mode){localStorage.removeItem(key(user,mode));}
function list(user){return ['quick','campaign'].map(m=>{const s=load(user,m);return {mode:m,t:s?s.t:null,turn:s?s.state.turn:null,faction:s?s.state.human:null,over:s?s.state.over:false};});}
function exportJSON(user,mode){const s=load(user,mode);if(!s)return;const b=new Blob([JSON.stringify(s)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`colonization_${user}_${mode}.json`;a.click();}
return {users,addUser,lastUser,save,load,remove,list,exportJSON};
})();
