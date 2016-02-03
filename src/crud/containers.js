import uuid from 'uuid';
import React, { Children, Component, cloneElement } from 'react';
import { connect } from 'react-redux';
import loading from './loading';
import * as utils from '../utils';
import { createPromiseAction } from '../actions';


export const createMapStateToProps = (mountPoint, folder='', propName) => function mapStateToPropsList(state) {
  if (!utils.hasFolder(state[mountPoint], folder)) {
    return { [propName]: null };
  }
  return {
    [propName]: utils.getDocumentsInFolder(state[mountPoint], folder),
    folderVars: utils.getFolderVars(state[mountPoint], folder),
  };
};


/**
 * combines result of two mapStateToProps functions
 *
 * @param fun1
 * @param fun2
 * @returns {object} combined stateProps
 */
function combineMapStateToProps(fun1, fun2) {
  return (state, ownProps) => Object.assign(
    {},
    fun1(state, ownProps),
    fun2 ? fun2(state, ownProps) : null
  )
}


export const singleObjectMapStateToProps = (mountPoint, propName) => function singleObjectMapStateToProps(state, ownProps) {
  const id = ownProps.docId;
  return {
    id,
    [propName]: utils.getObjectFromState(state, mountPoint, id),
  }
};


export function folderNameFromOpts(options) {
  return JSON.stringify(options);
}


export function createListAction(crud, folder, opts, folderVars) {
  const { options={} } = opts;

  return () => {
    if (opts.queryFunc) {
      return createPromiseAction(
        () => opts.queryFunc(options),
        crud.actionTypes.query,
        {...folderVars, folder}
      );
    } else if (options.fun) {
      const {fun, ...queryOptions} = options.fun;
      return crud.actions.query(
        fun,
        folder,
        queryOptions,
        folderVars
      );
    } else {
      return crud.actions.allDocs(
        folder, {
          startkey: crud.mountPoint + '-',
          endkey: crud.mountPoint + '-\uffff',
          ...options
        }, folderVars);
    }
  }
}

export function createMapStateToPropsList(crud, opts={}, mapStateToProps) {

  return (state, ownProps) => {
    let props = mapStateToProps ? mapStateToProps(state, ownProps) : {};
    const finalOpts = Object.assign(
      {},
      opts,
      props.listOpts,
    )
    const {options = {}, folder, propName = 'items', queryFunc, ...folderVars} = finalOpts;
    const toFolder = folder || folderNameFromOpts(options);

    Object.assign(
      props,
      createMapStateToProps(crud.mountPoint, toFolder, propName)(state)
    );

    props.action = createListAction(crud, toFolder, finalOpts, folderVars);
    return props;
  }

}

export function wrap(mapStateToProps, mapDispatchToProps) {
  return function(WrappedComponent) {
    return connect(mapStateToProps, mapDispatchToProps)(
      loading()(WrappedComponent)
    );
  }
}

export function connectList(crud, opts={}, mapStateToProps, mapDispatchToProps) {

  const mapStateToPropsFinal = createMapStateToPropsList(
    crud,
    opts,
    mapStateToProps
  );
  return wrap(mapStateToPropsFinal, mapDispatchToProps);
}


/**
 * Returns onSubmit handler that dispatch `put` action
 *
 * @param {crud} crud
 * @returns {function}
 */
export function createOnSubmitHandler(crud) {
  return function onSubmit (item, data, dispatch) {
    const doc = {
      ...item,
      ...data
    };
    if (!doc._id) {
      doc._id = crud.mountPoint + '-' + uuid.v4();
    }
    dispatch(crud.actions.put(doc));
  }
}


/**
 * createOnRemoveHandler
 *
 * @param crud
 * @returns {function}
 */
export function createOnRemoveHandler(crud) {
  return function onRemove (dispatch, items) {
    dispatch(crud.actions.remove(items.toObject()));
  }
}


/**
 * Decorator connects passed component to include single document as `item`.
 *
 * @param {crud} crud
 */
export function connectSingleItem(crud, opts={}, mapStateToProps, mapDispatchToProps) {
  const { propName = 'item' } = opts;
  const loadFunction = c => { c.props.dispatch(crud.actions.get(c.props.id)); }
  const mergedMapStateToProps = combineMapStateToProps(
    singleObjectMapStateToProps(crud.mountPoint, propName),
    mapStateToProps
  )

  return function(WrappedComponent) {
    return connect(mergedMapStateToProps, mapDispatchToProps)(loading(loadFunction, { propName })(WrappedComponent));
  }
};
