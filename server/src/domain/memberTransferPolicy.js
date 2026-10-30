export function memberTransferError({ member, destination, actorOrganisation }) {
  if (!member || !destination) return 'Member and destination branch are required.';
  if (destination.level !== 'branch' || destination.status !== 'active') {
    return 'A member can only be transferred to an active NCBI branch.';
  }
  if (String(member.homeOrganisation?._id ?? member.homeOrganisation) === String(destination._id)) {
    return 'Member already belongs to this branch.';
  }
  if (!actorOrganisation) return 'Your assigned organisation could not be verified.';
  return null;
}
