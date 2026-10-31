// Catalogue partagé par les menus, aperçus et filtres d'export, sans dépendance aux émetteurs.
export const transpilationLanguages = Object.freeze([
  Object.freeze({ id: 'javascript', name: 'JavaScript', extension: 'js', filterKey: 'files.jsFilter', available: true }),
  Object.freeze({ id: 'python', name: 'Python', extension: 'py', filterKey: 'files.pyFilter', available: true }),
  Object.freeze({ id: 'c', name: 'C', extension: 'c', available: false }),
  Object.freeze({ id: 'cpp', name: 'C++', extension: 'cpp', available: false }),
  Object.freeze({ id: 'java', name: 'Java', extension: 'java', available: false }),
])
