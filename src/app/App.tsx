import { useEffect } from "react";
import { buildingDefinitions, districtSlots } from "../game/data/buildings";
import { resourceDefinitions } from "../game/data/resources";
import { researchNodes } from "../game/data/research";
import { sectorDefinitions } from "../game/data/sectors";
import { useGameStore } from "../game/state/store";
import type { BuildingDefinition, ExpeditionKind, ResourceId, SectorStateId, ViewMode } from "../game/types";

const buildingMap = Object.fromEntries(
  buildingDefinitions.map((definition) => [definition.id, definition])
) as Record<string, BuildingDefinition>;

const sectorStateLabel: Record<SectorStateId, string> = {
  known: "Known",
  surveying: "Surveying",
  surveyed: "Surveyed",
  exploiting: "Exploiting",
  secured: "Secured",
  outpost: "Outpost"
};

const speedOptions = [0, 1, 2, 4];

function formatResource(value: number) {
  return value.toFixed(value < 10 ? 1 : 0);
}

function ResourceHud() {
  const resources = useGameStore((state) => state.resources);
  const population = useGameStore((state) => state.population);

  return (
    <header className="hud">
      <div className="brand">
        <p className="eyebrow">Pestizide Punk</p>
        <h1>Reactor City Authority</h1>
      </div>
      <div className="resource-grid">
        {resourceDefinitions.map((resource) => (
          <div className="resource-chip" key={resource.id}>
            <span className="resource-dot" style={{ background: resource.color }} />
            <span className="resource-label">{resource.label}</span>
            <strong>{formatResource(resources[resource.id])}</strong>
          </div>
        ))}
      </div>
      <div className="population-summary">
        <div>
          <span>Health</span>
          <strong>{population.health.toFixed(0)}%</strong>
        </div>
        <div>
          <span>Contamination</span>
          <strong>{population.contamination.toFixed(0)}%</strong>
        </div>
        <div>
          <span>Stability</span>
          <strong>{population.stability.toFixed(0)}%</strong>
        </div>
      </div>
    </header>
  );
}

function WorldMap() {
  const sectors = useGameStore((state) => state.sectors);
  const selectedSectorId = useGameStore((state) => state.selectedSectorId);
  const selectSector = useGameStore((state) => state.selectSector);
  const setView = useGameStore((state) => state.setView);

  return (
    <section className="canvas-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">World Overview</p>
          <h2>Hazard Rings</h2>
        </div>
        <button className="ghost-button" onClick={() => setView("city")}>
          Enter City
        </button>
      </div>
      <svg className="map-svg" viewBox="0 0 100 100" role="img" aria-label="World overview map">
        <defs>
          <radialGradient id="reactorGlow">
            <stop offset="0%" stopColor="#ffda73" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#d55b2c" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="38" className="ring ring-outer" />
        <circle cx="50" cy="50" r="24" className="ring ring-inner" />
        <circle cx="50" cy="50" r="12" fill="url(#reactorGlow)" />
        <g className="city-node" onClick={() => setView("city")} role="button" tabIndex={0}>
          <circle cx="50" cy="50" r="8.2" />
          <text x="50" y="51.5" textAnchor="middle">
            City
          </text>
        </g>
        {sectorDefinitions.map((sector) => {
          const runtime = sectors.find((item) => item.id === sector.id)!;
          const radius = sector.ring === 1 ? 24 : 38;
          const radians = (sector.angle * Math.PI) / 180;
          const x = 50 + Math.cos(radians) * radius;
          const y = 50 + Math.sin(radians) * radius;
          const className = [
            "sector-node",
            `sector-${runtime.state}`,
            selectedSectorId === sector.id ? "selected" : ""
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <g key={sector.id} className={className} onClick={() => selectSector(sector.id)} role="button" tabIndex={0}>
              <circle cx={x} cy={y} r={runtime.discovered ? 6.2 : 5.5} />
              <text x={x} y={y + 0.8} textAnchor="middle">
                {sector.name
                  .split(" ")
                  .map((word) => word[0])
                  .join("")}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}

function CityView() {
  const buildings = useGameStore((state) => state.buildings);
  const selectedSlotId = useGameStore((state) => state.selectedSlotId);
  const selectSlot = useGameStore((state) => state.selectSlot);
  const setView = useGameStore((state) => state.setView);

  return (
    <section className="canvas-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">City View</p>
          <h2>Reactor District Slots</h2>
        </div>
        <button className="ghost-button" onClick={() => setView("world")}>
          Back To World
        </button>
      </div>
      <div className="city-plate">
        <div className="reactor-core">
          <span>REACTOR</span>
          <strong>Core</strong>
        </div>
        {districtSlots.map((slot) => {
          const building = buildings.find((item) => item.slotId === slot.id);
          const definition = building ? buildingMap[building.buildingId] : null;
          return (
            <button
              key={slot.id}
              className={`district-slot ${selectedSlotId === slot.id ? "selected" : ""} ${building ? "occupied" : "empty"}`}
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              onClick={() => selectSlot(slot.id)}
            >
              <span>{slot.label}</span>
              <strong>{definition?.name ?? "Empty Slot"}</strong>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ViewTabs() {
  const view = useGameStore((state) => state.view);
  const setView = useGameStore((state) => state.setView);
  const tabs: { id: ViewMode; label: string }[] = [
    { id: "world", label: "World" },
    { id: "city", label: "City" },
    { id: "research", label: "Research" }
  ];

  return (
    <nav className="view-tabs">
      {tabs.map((tab) => (
        <button key={tab.id} className={view === tab.id ? "active" : ""} onClick={() => setView(tab.id)}>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

function SectorActionButtons() {
  const selectedSectorId = useGameStore((state) => state.selectedSectorId);
  const sectors = useGameStore((state) => state.sectors);
  const launchExpedition = useGameStore((state) => state.launchExpedition);
  const researched = useGameStore((state) => state.researched);
  const resources = useGameStore((state) => state.resources);

  const sectorDefinition = sectorDefinitions.find((sector) => sector.id === selectedSectorId);
  const sectorRuntime = sectors.find((sector) => sector.id === selectedSectorId);
  if (!sectorDefinition || !sectorRuntime) return null;

  const canStart = (kind: ExpeditionKind) => {
    const requirement =
      kind === "survey"
        ? sectorDefinition.access
        : kind === "exploit"
          ? sectorDefinition.exploit
          : kind === "secure"
            ? sectorDefinition.secure
            : { tech: ["relay-network"] };

    const techOk = (requirement.tech ?? []).every((techId) => researched.includes(techId));
    const gearTier = resources.gear >= 10 ? 2 : resources.gear >= 4 ? 1 : 0;
    return techOk && gearTier >= (requirement.gear ?? 0);
  };

  return (
    <div className="action-stack">
      <button disabled={sectorRuntime.state !== "known"} onClick={() => launchExpedition(sectorDefinition.id, "survey")}>
        Survey Sector
      </button>
      <button
        disabled={sectorRuntime.state !== "surveyed" || !canStart("exploit")}
        onClick={() => launchExpedition(sectorDefinition.id, "exploit")}
      >
        Start Exploitation
      </button>
      <button
        disabled={sectorRuntime.state !== "exploiting" || !canStart("secure")}
        onClick={() => launchExpedition(sectorDefinition.id, "secure")}
      >
        Secure Sector
      </button>
      <button
        disabled={sectorRuntime.state !== "secured" || !canStart("outpost")}
        onClick={() => launchExpedition(sectorDefinition.id, "outpost")}
      >
        Raise Outpost
      </button>
    </div>
  );
}

function DetailsPanel() {
  const view = useGameStore((state) => state.view);
  const selectedSectorId = useGameStore((state) => state.selectedSectorId);
  const selectedSlotId = useGameStore((state) => state.selectedSlotId);
  const sectors = useGameStore((state) => state.sectors);
  const buildings = useGameStore((state) => state.buildings);
  const buildInSlot = useGameStore((state) => state.buildInSlot);
  const researched = useGameStore((state) => state.researched);
  const activeResearch = useGameStore((state) => state.activeResearch);
  const startResearch = useGameStore((state) => state.startResearch);
  const resources = useGameStore((state) => state.resources);

  const selectedSector = sectorDefinitions.find((sector) => sector.id === selectedSectorId);
  const selectedSectorState = sectors.find((sector) => sector.id === selectedSectorId);
  const selectedSlot = districtSlots.find((slot) => slot.id === selectedSlotId);
  const existingBuilding = buildings.find((item) => item.slotId === selectedSlotId);

  const buildOptions = buildingDefinitions.filter((definition) => {
    if (definition.unlockTech && !researched.includes(definition.unlockTech)) return false;
    return !buildings.some((instance) => instance.slotId === selectedSlotId);
  });

  return (
    <aside className="detail-panel">
      {view === "world" && selectedSector && selectedSectorState ? (
        <>
          <div className="panel-header">
            <div>
              <p className="eyebrow">{selectedSector.archetype}</p>
              <h2>{selectedSector.name}</h2>
            </div>
            <span className={`status-pill ${selectedSectorState.state}`}>{sectorStateLabel[selectedSectorState.state]}</span>
          </div>
          <p className="panel-copy">{selectedSector.description}</p>
          <div className="panel-grid">
            <div>
              <span>Ring</span>
              <strong>{selectedSector.ring}</strong>
            </div>
            <div>
              <span>Hazards</span>
              <strong>
                {Object.entries(selectedSector.hazard)
                  .map(([hazard, score]) => `${hazard} ${score}`)
                  .join(" / ")}
              </strong>
            </div>
          </div>
          <div className="subsection">
            <h3>Yield</h3>
            <ul className="flat-list">
              {Object.entries(selectedSector.resources).map(([resourceId, amount]) => (
                <li key={resourceId}>
                  {resourceDefinitions.find((resource) => resource.id === (resourceId as ResourceId))?.label ?? resourceId}
                  <strong>+{Number(amount ?? 0)}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="subsection">
            <h3>Actions</h3>
            <SectorActionButtons />
          </div>
        </>
      ) : null}

      {view === "city" && selectedSlot ? (
        <>
          <div className="panel-header">
            <div>
              <p className="eyebrow">District Slot</p>
              <h2>{selectedSlot.label}</h2>
            </div>
          </div>
          {existingBuilding ? (
            <>
              <p className="panel-copy">{buildingMap[existingBuilding.buildingId].description}</p>
              <div className="subsection">
                <h3>Building</h3>
                <div className="card-emphasis">{buildingMap[existingBuilding.buildingId].name}</div>
              </div>
            </>
          ) : (
            <>
              <p className="panel-copy">Build into this district slot to widen your economy and unlock new sector actions.</p>
              <div className="subsection">
                <h3>Build Menu</h3>
                <div className="build-list">
                  {buildOptions.map((definition) => (
                    <button key={definition.id} className="build-option" onClick={() => buildInSlot(selectedSlot.id, definition.id)}>
                      <span>{definition.name}</span>
                      <small>{definition.description}</small>
                    </button>
                  ))}
                  {buildOptions.length === 0 ? <div className="muted-box">All available buildings here are locked or already built.</div> : null}
                </div>
              </div>
            </>
          )}
        </>
      ) : null}

      {view === "research" ? (
        <>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Technology</p>
              <h2>Progression Grid</h2>
            </div>
          </div>
          <div className="subsection">
            <h3>Active Research</h3>
            <div className="card-emphasis">
              {activeResearch
                ? `${researchNodes.find((item) => item.id === activeResearch.nodeId)?.name ?? "Unknown"} (${activeResearch.progress.toFixed(0)}%)`
                : "No active project"}
            </div>
          </div>
          <div className="tech-list">
            {researchNodes.map((node) => {
              const unlocked = researched.includes(node.id);
              const available =
                !unlocked &&
                !activeResearch &&
                node.prerequisites.every((item) => researched.includes(item)) &&
                resources.research >= node.cost;

              return (
                <button
                  key={node.id}
                  className={`tech-node ${unlocked ? "done" : available ? "available" : "locked"}`}
                  onClick={() => startResearch(node.id)}
                  disabled={!available}
                >
                  <span>{node.branch}</span>
                  <strong>{node.name}</strong>
                  <small>{node.description}</small>
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </aside>
  );
}

function ResearchCanvas() {
  const researched = useGameStore((state) => state.researched);
  const activeResearch = useGameStore((state) => state.activeResearch);

  const branches = ["Chemistry", "Protection", "Renewables", "Logistics", "Medicine", "Infrastructure", "Defense", "Scouting"];

  return (
    <section className="canvas-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Research Lattice</p>
          <h2>Chemistry, Protection, Logistics</h2>
        </div>
      </div>
      <div className="research-board">
        {branches.map((branch) => (
          <div key={branch} className="branch-column">
            <h3>{branch}</h3>
            {researchNodes.filter((node) => node.branch === branch).map((node) => (
              <article
                key={node.id}
                className={`branch-card ${researched.includes(node.id) ? "done" : activeResearch?.nodeId === node.id ? "active" : ""}`}
              >
                <span>Tier {node.tier}</span>
                <strong>{node.name}</strong>
                <small>{node.description}</small>
              </article>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function BottomBar() {
  const speed = useGameStore((state) => state.speed);
  const elapsedSeconds = useGameStore((state) => state.elapsedSeconds);
  const activeEvent = useGameStore((state) => state.activeEvent);
  const expeditions = useGameStore((state) => state.expeditions);
  const log = useGameStore((state) => state.log);
  const setSpeed = useGameStore((state) => state.setSpeed);
  const saveGame = useGameStore((state) => state.saveGame);
  const resetGame = useGameStore((state) => state.resetGame);
  const advanceTime = useGameStore((state) => state.advanceTime);

  return (
    <footer className="bottom-bar">
      <div className="control-group">
        {speedOptions.map((option) => (
          <button key={option} className={speed === option ? "active" : ""} onClick={() => setSpeed(option)}>
            {option === 0 ? "Pause" : `${option}x`}
          </button>
        ))}
        <button onClick={() => advanceTime(10000)}>Advance +10s</button>
        <button onClick={saveGame}>Save</button>
        <button className="danger-lite" onClick={resetGame}>
          Reset
        </button>
      </div>
      <div className="status-block">
        <span>Elapsed</span>
        <strong>
          {Math.floor(elapsedSeconds / 60)}m {String(elapsedSeconds % 60).padStart(2, "0")}s
        </strong>
      </div>
      <div className="status-block wide">
        <span>Event</span>
        <strong>{activeEvent ? `${activeEvent.title} (${activeEvent.remaining}s)` : "No active threat"}</strong>
      </div>
      <div className="status-block wide">
        <span>Expeditions</span>
        <strong>
          {expeditions.length > 0
            ? expeditions.map((item) => `${item.kind}:${item.remaining}s`).join(" | ")
            : "No missions underway"}
        </strong>
      </div>
      <div className="status-block wide">
        <span>Log</span>
        <strong>{log[0]}</strong>
      </div>
    </footer>
  );
}

function AlertStack() {
  const alerts = useGameStore((state) => state.alerts);

  return (
    <div className="alert-stack">
      {alerts.map((alert) => (
        <div key={alert.id} className={`alert-card ${alert.tone}`}>
          {alert.text}
        </div>
      ))}
    </div>
  );
}

function TutorialPanel() {
  return (
    <section className="tutorial-panel">
      <p className="eyebrow">Directive</p>
      <h2>First Shift Checklist</h2>
      <ol className="flat-list ordered">
        <li>Survey nearby sectors and claim quick salvage.</li>
        <li>Research Filter Masks or Renewable Grid depending on your shortage.</li>
        <li>Build into empty city slots when staff and materials allow it.</li>
        <li>Exploit then secure sectors to push passive income higher.</li>
        <li>Watch contamination, water, and food before chasing deep expansion.</li>
      </ol>
    </section>
  );
}

export function App() {
  const view = useGameStore((state) => state.view);
  const speed = useGameStore((state) => state.speed);
  const advanceTime = useGameStore((state) => state.advanceTime);

  useEffect(() => {
    if (speed === 0) return undefined;
    const handle = window.setInterval(() => {
      advanceTime(1000 * speed);
    }, 1000);
    return () => window.clearInterval(handle);
  }, [advanceTime, speed]);

  return (
    <div className="app-shell">
      <ResourceHud />
      <main className="main-layout">
        <div className="left-column">
          <ViewTabs />
          {view === "world" ? <WorldMap /> : null}
          {view === "city" ? <CityView /> : null}
          {view === "research" ? <ResearchCanvas /> : null}
          <AlertStack />
        </div>
        <div className="right-column">
          <TutorialPanel />
          <DetailsPanel />
        </div>
      </main>
      <BottomBar />
    </div>
  );
}

