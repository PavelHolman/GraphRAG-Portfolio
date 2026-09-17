export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['web', 'schema', 'graph-index', 'retrieval', 'content', 'docs', 'tooling', 'ci', 'evals'],
    ],
  },
};
