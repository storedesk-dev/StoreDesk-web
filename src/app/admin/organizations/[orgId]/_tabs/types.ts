import type { Organization } from "../../../_lib/api";

export interface OrgTabProps {
  orgId: string;
  org: Organization;
  /** Re-read the organization (name, status, tab counts). */
  refreshOrg: () => void;
}
