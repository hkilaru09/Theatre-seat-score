const ROWS = [
  ["Immersion", "Horizontal angle the screen fills", "SMPTE ≥ 30°, THX ≈ 36–40°, IMAX ≈ 60°"],
  ["Neck comfort", "Upward angle to screen center and top edge", "≤ 12° to center, ≤ 30° to top"],
  ["Centering", "Angle off the screen's centerline", "Full score within 4°"],
  ["Sound", "Distance from the mix position", "⅔ of room depth, centered"],
  ["Clear view", "C-value: clearance over the eyes in front", "120 mm is ideal"],
  ["Aisle access", "Seat at an aisle or row end", "Yes or no"],
];

export function Method() {
  return (
    <section className="panel" aria-labelledby="method-title">
      <h2 id="method-title">How the score works</h2>
      <div className="method">
        <div className="prose">
          <p>
            Each seat gets six factor scores between 0 and 1, computed from the room's real geometry: screen size and height, distance to each
            row, row rise and seat position. The total is the weighted average of those factors on a 0 to 100 scale, using the weights you set.
          </p>
          <p>
            The group finder looks along each row for runs of open seats with no aisle in between. It slides a window of your group's size along
            each run and ranks blocks by 75% average score and 25% worst seat, so nobody in the group ends up with a bad seat.
          </p>
          <p>Bookings shown on load are a random sample, not live data. Good seats are more likely to be taken, as they are in real theaters.</p>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Factor</th>
                <th>What is measured</th>
                <th>Rule of thumb</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([factor, what, rule]) => (
                <tr key={factor}>
                  <td>{factor}</td>
                  <td>{what}</td>
                  <td className="mono">{rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
