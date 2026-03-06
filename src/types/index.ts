export interface UserNode {
  id: string;
  name: string;
  surname: string;
  maidenName?: string;
  gender?: "male" | "female";
  dateOfBirth?: string;
  city?: string;
  community?: string;
  otherInfo?: string;
  fatherId?: string;
  motherId?: string;
  spouseId?: string;
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  type: "family" | "community";
  label?: string;
}