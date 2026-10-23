// Illustrative photos (public domain, see public/assets/photos/CREDITS.md) matched to an opportunity's activity.
const PHOTOS = {
  beach: { name: 'beach-cleanup', alt: 'Volunteers in safety vests collecting debris on a beach' },
  trees: { name: 'tree-planting', alt: 'Volunteers planting saplings in a woodland clearing' },
  food: { name: 'community-meal', alt: 'Volunteers in aprons serving a community meal' },
  education: { name: 'teaching-children', alt: 'A volunteer helping children write in a notebook' },
  animals: { name: 'animal-shelter', alt: 'Volunteers walking shelter dogs on leashes' },
  health: { name: 'blood-drive', alt: 'A volunteer donating blood at a blood drive' },
  arts: { name: 'school-mural', alt: 'A painter showing pupils how to paint a school mural' },
  community: { name: 'neighborhood-cleanup', alt: 'Volunteers with rakes and shovels cleaning up a neighborhood' },
}

const BY_CATEGORY = {
  'Community Support': 'community',
  'Hunger & Food': 'food',
  Education: 'education',
  Environment: 'trees',
  'Animal Welfare': 'animals',
  'Health & Wellness': 'health',
  'Arts & Culture': 'arts',
}

export function opportunityPhoto(opportunity) {
  const title = (opportunity.title || '').toLowerCase()
  let key = BY_CATEGORY[opportunity.category] || 'community'
  if (/beach|coast|shore|ocean|river|plastic/.test(title)) key = 'beach'
  else if (/tree|plant/.test(title)) key = 'trees'

  const { name, alt } = PHOTOS[key]
  return {
    src: `/assets/photos/${name}.jpg`,
    srcSet: `/assets/photos/${name}-sm.jpg 500w, /assets/photos/${name}.jpg 1280w`,
    alt,
  }
}
