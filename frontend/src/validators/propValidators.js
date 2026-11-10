export const dateStringValidator = (props, propName, componentName) => {
  const value = props[propName];

  if (value && isNaN(Date.parse(value))) {
    return new Error(
      `Invalid prop \`${propName}\` supplied to \`${componentName}\`. Expected a valid date string (ISO 8601) but received \`${value}\`.`
    );
  }
};

export const urlValidator = (props, propName, componentName) => {
  const url = props[propName];

  // An absent optional prop is not an invalid one. `new URL(undefined)` throws
  // like any other bad input, so a component that simply did not pass one --
  // every host that fetches its own bytes, for filePreviewPath -- warned on
  // each mount. dateStringValidator above already works this way.
  if (url === undefined || url === null) return;

  try {
    new URL(url);
    return;
  } catch (error) {
    return new Error(
      `Invalid prop \`${propName}\` supplied to \`${componentName}\`. Expected a valid URL but received \`${url}\`.`
    );
  }
};
