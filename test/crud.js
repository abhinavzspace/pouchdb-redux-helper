/* globals emit */

import test from 'tape';
import { List, Map } from 'immutable';

import { createPromiseAction } from '../src/actions';
import createCRUD, { INITIAL_STATE } from '../src/crud/crud';
import * as utils from '../src/utils';
import db from './testDb';
import { doc, allDocsPayload } from './testUtils';

const crud = createCRUD(db, 'mountPoint');
const {reducer, actionTypes} = crud;


test('crud has db', t => {
  t.equal(crud.db, db);
  t.end();
});

test('createCrud sets default startkey, endkey', t => {
  t.equal(crud.startkey, 'mountPoint-');
  t.equal(crud.endkey, 'mountPoint-\uffff');
  t.end();
});

test('createCrud with startkey, endkey options', t => {
  const c = createCRUD(db, 'mountPoint', null, {startkey: null, endkey: null});
  t.equal(c.startkey, null);
  t.equal(c.endkey, null);
  t.end();
});

test('reducer should have initial state', t => {
  const state = reducer(undefined, {});
  t.ok(state instanceof Map, 'should be Map');
  t.equal(utils.getFoldersFromState(state), Map());
  t.equal(utils.getDocumentsFromState(state), Map());
  t.end();
});

test('reducer should handle ALL_DOCS action type', t => {
  const state = reducer(INITIAL_STATE, {
    type: actionTypes.allDocs.success,
    folder: '',
    payload: allDocsPayload,
  });
  t.ok(utils.hasFolder(state, ''), 'has folder');
  t.equal(utils.getIdsFromFolder(state, '').get(0), doc._id);
  t.deepEqual(utils.getDocument(state, doc._id).toObject(), doc);
  t.end();
});

test('reducer should handle QUERY action type', t => {
  const state = reducer(INITIAL_STATE, {
    type: actionTypes.query.success,
    folder: '',
    payload: allDocsPayload,
  });
  t.ok(utils.hasFolder(state, ''), 'has folder');
  t.equal(utils.getIdsFromFolder(state, '').get(0), doc._id);
  t.deepEqual(utils.getDocument(state, doc._id).toObject(), doc);
  t.end();
});


test('test folderVars', t => {
  const state = reducer(INITIAL_STATE, {
    type: actionTypes.query.success,
    folder: '',
    payload: allDocsPayload,
    foo: 'bar',
  });
  const folderVars = utils.getFolderVars(state, '');
  t.equal(folderVars.size, 1, 'should have 1 var');
  t.equal(folderVars.get('foo'), 'bar', 'foo var should be saved in state');
  t.end();
});

test('reducer should handle PUT success', t => {
  const initialState = utils.setDocument(INITIAL_STATE, doc);
  const payload = {
    ok: true,
    rev: 'rev-2',
    id: doc._id,
  }
  const state = reducer(initialState, {
    type: actionTypes.put.success,
    payload: payload,
    doc: { ...doc, title: 'foo' }
  });
  const updatedDoc = utils.getDocument(state, doc._id);
  t.equal(updatedDoc.get('title'), 'foo');
  t.equal(updatedDoc.get('_rev'), payload.rev);
  t.end();
});

test('reducer should handle REMOVE success', t => {
  const initialState = utils.setDocument(
    utils.saveIdsInFolder(INITIAL_STATE, '', List([doc._id])),
    doc
  )
  const state = reducer(initialState, {
    type: actionTypes.remove.success,
    payload: { id: doc._id },
    doc: { ...doc }
  });
  t.equal(utils.getDocumentsFromState(state).count(), 0);
  t.equal(utils.getIdsFromFolder(state, '').count(), 0);
  t.end();
});


test('reducer should include paths', t => {
  t.deepEqual(crud.paths, {
    create: '/mountPoint/new/',
    detail: '/mountPoint/:id/',
    edit: '/mountPoint/:id/edit/',
    list: '/mountPoint/',
  });
  t.end();
});


test('test crud action allDocs', t => {
  const doc = {
    _id: 'crud-alldocs',
    title: 'Sound and Vision',
  }

  db.put(doc).then(() => {
    let dispatchCounter = 0;
    const dispatch = action => {
      switch (dispatchCounter) {
        case 0:
          t.equal(action.type, crud.actionTypes.allDocs.request);
          t.equal(action.folder, '');
          break;
        case 1:
          t.equal(action.type, crud.actionTypes.allDocs.success);
          t.equal(action.folder, '');
          t.ok(action.payload, 'should have payload');
          t.equal(action.payload.rows[0].doc.title, doc.title);
          t.end()
          break;
      }
      dispatchCounter++;
    }
    const allDocs = crud.actions.allDocs();
    t.equal(typeof allDocs, 'function');
    allDocs(dispatch);
  });
});


test('test crud action query', t => {
  var ddoc = {
    _id: '_design/byYear',
    views: {
      byYear: {
        map: function mapFun(doc) {
          if (doc.year) {
            emit(doc.year);
          }
        }.toString()
      }
    }
  }
  const doc = {
    _id: 'doc-1',
    title: 'Sound and Vision',
    year: 1977,
  }

  Promise.all([
    db.put(doc),
    db.put(ddoc),
  ]).then(() => {
    let dispatchCounter = 0;
    const dispatch = action => {
      switch (dispatchCounter) {
        case 0:
          t.equal(action.type, crud.actionTypes.query.request);
          t.equal(action.folder, '70s');
          break;
        case 1:
          t.equal(action.type, crud.actionTypes.query.success);
          t.equal(action.folder, '70s');
          t.ok(action.payload, 'should have payload');
          t.equal(action.payload.rows[0].doc.year, 1977);
          t.end()
          break;
      }
      dispatchCounter++;
    }
    const query = crud.actions.query('byYear', '70s', {
      startkey: 1970,
      endkey: 1980
    });
    query(dispatch);
  });
});


test('test crud action get', t => {
  const doc = {
    _id: 'doc-2',
    title: 'Sound and Vision',
  }

  db.put(doc).then(() => {
    let dispatchCounter = 0;
    const dispatch = action => {
      switch (dispatchCounter) {
        case 0:
          t.equal(action.type, crud.actionTypes.get.request);
          t.equal(action.docId, doc._id);
          break;
        case 1:
          t.equal(action.type, crud.actionTypes.get.success);
          t.equal(action.docId, doc._id);
          t.ok(action.payload, 'should have payload');
          t.equal(action.payload.title, doc.title);
          t.end()
          break;
      }
      dispatchCounter++;
    }
    const get = crud.actions.get(doc._id);
    get(dispatch);
  });
});


test('test crud action put', t => {
  const doc = {
    _id: 'doc-3',
    title: 'Sound and Vision',
  }

  db.put(doc).then((res) => {
    let dispatchCounter = 0;
    const dispatch = action => {
      switch (dispatchCounter) {
        case 0:
          t.equal(action.type, crud.actionTypes.put.request);
          t.equal(action.doc._id, doc._id);
          break;
        case 1:
          t.equal(action.type, crud.actionTypes.put.success);
          t.ok(action.payload, 'should have payload');
          t.ok(action.payload.rev, 'payload should have rev');
          t.ok(action.payload.ok, 'payload should have ok');
          t.end()
          break;
      }
      dispatchCounter++;
    }
    const put = crud.actions.put({...doc, _rev: res.rev});
    put(dispatch);
  });
});



test('test crud action remove', t => {
  const doc = {
    _id: 'doc-4',
    title: 'Sound and Vision',
  }

  db.put(doc).then((res) => {
    let dispatchCounter = 0;
    const dispatch = action => {
      switch (dispatchCounter) {
        case 0:
          t.equal(action.type, crud.actionTypes.remove.request);
          t.equal(action.doc._id, doc._id);
          break;
        case 1:
          t.equal(action.type, crud.actionTypes.remove.success);
          t.ok(action.payload, 'should have payload');
          t.ok(action.payload.rev, 'payload should have rev');
          t.ok(action.payload.ok, 'payload should have ok');
          t.end()
          break;
      }
      dispatchCounter++;
    }
    const remove = crud.actions.remove({...doc, _rev: res.rev});
    remove(dispatch);
  });
});


test('test createCRUD assertions', t => {
  t.throws(
    createCRUD,
    /^Invariant Violation/,
    'calling without db should throw an error'
  );
  t.end();
});
