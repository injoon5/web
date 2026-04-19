// All operations go through the admin SDK on the server, which bypasses permissions.
// These rules block direct client access to the data.
const rules = {
  $default: {
    allow: {
      $default: 'false',
    },
  },
};

export default rules;
