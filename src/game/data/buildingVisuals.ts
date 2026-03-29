export interface BuildingVisualDefinition {
  icon: string;
  label: string;
  tint: string;
}

export const cityVisual = {
  hero: "/city/reactor-city.png",
  core: "/city/reactor-core.png",
  worldIcon: "/world-hex/world-city-core-icon.png",
  label: "Reactor City"
};

export const buildingVisualMap: Record<string, BuildingVisualDefinition> = {
  "solar-array": { icon: "/buildings/icons/solar-array.png", label: "Solar", tint: "rgba(234, 192, 103, 0.22)" },
  "wind-turbine": { icon: "/buildings/icons/wind-turbine.png", label: "Wind", tint: "rgba(159, 214, 209, 0.2)" },
  "coal-boiler-plant": { icon: "/buildings/icons/dirty-power.png", label: "Coal", tint: "rgba(179, 126, 83, 0.24)" },
  "oil-generator": { icon: "/buildings/icons/oil-generator.png", label: "Oil", tint: "rgba(165, 112, 76, 0.24)" },
  "biomass-gasifier": { icon: "/buildings/icons/bio-reactor.png", label: "Biomass", tint: "rgba(121, 177, 101, 0.22)" },
  "biogas-digester": { icon: "/buildings/icons/biogas-digester.png", label: "Biogas", tint: "rgba(121, 177, 101, 0.22)" },
  "geothermal-well": { icon: "/buildings/icons/geothermal-well.png", label: "Geo", tint: "rgba(210, 135, 92, 0.24)" },
  "micro-hydro-station": { icon: "/buildings/icons/hydro-station.png", label: "Hydro", tint: "rgba(91, 164, 203, 0.22)" },
  "redox-battery-bank": { icon: "/buildings/icons/battery-storage.png", label: "Redox", tint: "rgba(130, 197, 214, 0.22)" },
  "steam-accumulator": { icon: "/buildings/icons/steam-accumulator.png", label: "Steam", tint: "rgba(186, 153, 115, 0.22)" },
  "waste-heat-recovery-unit": { icon: "/buildings/icons/industrial-works.png", label: "Heat", tint: "rgba(204, 136, 92, 0.2)" },
  "scrap-foundry": { icon: "/buildings/icons/industrial-works.png", label: "Foundry", tint: "rgba(173, 138, 98, 0.22)" },
  "glassworks": { icon: "/buildings/icons/glassworks.png", label: "Glass", tint: "rgba(123, 198, 206, 0.2)" },
  "compost-yard": { icon: "/buildings/icons/compost-yard.png", label: "Compost", tint: "rgba(121, 177, 101, 0.2)" },
  "synthetic-fertilizer-plant": { icon: "/buildings/icons/chemical-plant.png", label: "Fertilizer", tint: "rgba(192, 137, 88, 0.22)" },
  "pesticide-plant": { icon: "/buildings/icons/chemical-plant.png", label: "Pesticide", tint: "rgba(196, 109, 87, 0.24)" },
  "field-lab": { icon: "/buildings/icons/field-lab.png", label: "Lab", tint: "rgba(128, 174, 210, 0.22)" },
  "beneficial-fungi-lab": { icon: "/buildings/icons/beneficial-fungi-lab.png", label: "Bio Lab", tint: "rgba(118, 165, 112, 0.22)" },
  "worker-barracks": { icon: "/buildings/icons/housing-block.png", label: "Barracks", tint: "rgba(160, 132, 102, 0.22)" },
  "dispatch-office": { icon: "/buildings/icons/logistics-hub.png", label: "Dispatch", tint: "rgba(147, 162, 182, 0.2)" },
  "water-purifier": { icon: "/buildings/icons/utility-works.png", label: "Water", tint: "rgba(97, 174, 213, 0.22)" },
  "air-filter-station": { icon: "/buildings/icons/utility-works.png", label: "Air Filter", tint: "rgba(144, 182, 189, 0.2)" },
  "greenhouse": { icon: "/buildings/icons/greenhouse.png", label: "Greenhouse", tint: "rgba(121, 177, 101, 0.22)" },
  "external-fields": { icon: "/buildings/icons/external-fields.png", label: "Fields", tint: "rgba(181, 160, 91, 0.2)" },
  "pollinator-dome": { icon: "/buildings/icons/pollinator-dome.png", label: "Pollinator", tint: "rgba(140, 196, 116, 0.2)" },
  "aquaponics-hall": { icon: "/buildings/icons/aquaponics.png", label: "Aquaponics", tint: "rgba(89, 169, 174, 0.22)" },
  "fish-tanks": { icon: "/buildings/icons/fish-tanks.png", label: "Fish", tint: "rgba(82, 158, 188, 0.22)" },
  "algae-bioreactor": { icon: "/buildings/icons/algae-bioreactor.png", label: "Algae", tint: "rgba(86, 185, 154, 0.22)" },
  "mushroom-vault": { icon: "/buildings/icons/fungal-vault.png", label: "Fungi", tint: "rgba(124, 146, 102, 0.22)" },
  "mycoprotein-vats": { icon: "/buildings/icons/mycoprotein-vats.png", label: "Myco", tint: "rgba(124, 146, 102, 0.22)" },
  "insect-protein-farm": { icon: "/buildings/icons/insect-farm.png", label: "Insects", tint: "rgba(167, 151, 88, 0.22)" },
  "seed-vault": { icon: "/buildings/icons/greenhouse.png", label: "Seed Vault", tint: "rgba(152, 180, 104, 0.22)" },
  "gvo-crop-lab": { icon: "/buildings/icons/gvo-lab.png", label: "GVO", tint: "rgba(108, 191, 120, 0.24)" },
  "spray-tower": { icon: "/buildings/icons/defense-tower.png", label: "Spray", tint: "rgba(184, 116, 89, 0.22)" },
  "fumigation-tower": { icon: "/buildings/icons/defense-tower.png", label: "Fumigation", tint: "rgba(196, 104, 86, 0.24)" },
  "pheromone-hub": { icon: "/buildings/icons/pheromone-hub.png", label: "Pheromone", tint: "rgba(126, 183, 114, 0.22)" },
  "soil-sterilizer-rig": { icon: "/buildings/icons/soil-sterilizer-rig.png", label: "Sterilizer", tint: "rgba(198, 114, 86, 0.24)" },
  "clinic": { icon: "/buildings/icons/clinic.png", label: "Clinic", tint: "rgba(142, 184, 175, 0.2)" },
  "gear-depot": { icon: "/buildings/icons/protection-gear.png", label: "Gear", tint: "rgba(157, 158, 195, 0.2)" },
  "hazmat-locker": { icon: "/buildings/icons/protection-gear.png", label: "Hazmat", tint: "rgba(165, 179, 124, 0.22)" },
  "decon-showers": { icon: "/buildings/icons/clinic.png", label: "Decon", tint: "rgba(123, 177, 188, 0.2)" },
  "cartridge-workshop": { icon: "/buildings/icons/protection-gear.png", label: "Cartridges", tint: "rgba(155, 177, 198, 0.2)" },
  "dosimetry-post": { icon: "/buildings/icons/field-lab.png", label: "Dosimetry", tint: "rgba(160, 186, 132, 0.2)" },
  "vehicle-seal-bay": { icon: "/buildings/icons/vehicle-seal-bay.png", label: "Vehicle Seal", tint: "rgba(132, 164, 175, 0.2)" }
};
