const fs = require('fs');
const path = require('path');

describe('Zorgax cultural API wiring and privacy boundaries', () => {
  const routes = fs.readFileSync(path.join(__dirname, '../src/routes/authRoutes.js'), 'utf8');
  const controller = fs.readFileSync(path.join(__dirname, '../src/controllers/zorgaxCulturalController.js'), 'utf8');

  test('organizer mutations require authentication', () => {
    expect(routes).toContain("router.post('/zorgax/events', authenticate, zorgaxCulturalController.createEvent)");
    expect(routes).toContain("router.patch('/zorgax/events/:eventId/manage', authenticate, zorgaxCulturalController.updateOrganizerEvent)");
    expect(routes).toContain("router.put('/zorgax/artists/me', authenticate, zorgaxCulturalController.upsertMyArtistProfile)");
  });

  test('public event projection excludes account ownership and restricted location data', () => {
    expect(controller).toMatch(
      /findById\(req\.params\.eventId\)\.select\(['"]-ownerId -location\.restrictedText['"]\)/
    );
    expect(controller).toMatch(/event\.location\.mode === ['"]PRIVATE['"]/);
    expect(controller).toMatch(/event\.location\.mode === ['"]AUTHORIZED_RELEASE['"]/);
    expect(controller).toContain("event.location.publicText = ''");
  });

  test('organizer reads and writes are ownership scoped', () => {
    expect(controller).toContain("ownerId: req.user._id");
    expect(controller).toContain("findOne({ _id: req.params.eventId, ownerId: req.user._id })");
    expect(controller).toContain("findOneAndUpdate({ _id: req.params.eventId, ownerId: req.user._id }");
  });

  test('artist public endpoints hide account ownership', () => {
    expect(controller).toContain("select('-ownerId')");
  });
});