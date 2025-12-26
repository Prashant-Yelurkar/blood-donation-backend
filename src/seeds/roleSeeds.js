export const roles = [
  {
    name: "SUPER_ADMIN",
    permissions: [
      "donor:create",
      "donor:update",
      "donor:delete",
      "donor:view",
      "call:create",
      "call:update",
      "call:view",
      "report:view",
      "user:manage",
      "role:manage",
    ],
    description: "Super Administrator role with all permissions",
  },
    {
    name: "ADMIN",
    permissions: [
      "donor:create",
      "donor:update",
      "donor:delete",
      "donor:view",
      "call:create",
      "call:update",
      "call:view",
      "report:view",
      "user:manage",
      "role:manage",
    ],
    description: "Administrator role with all permissions of his Area",
  },
  {
    name: "VOLUNTEER",
    permissions: [
      "donor:create",
      "donor:update",
      "donor:view",
      "call:create",
      "call:update",
      "call:view",
      "report:view",
    ],
    description: "Volunteer role with limited permissions",
  },
  {
    name: "USER",
    permissions: [
      "donor:view",
      "report:view",
    ],
    description: "Normal user role",
  },
];

