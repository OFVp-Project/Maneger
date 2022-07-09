export default function calculate_transferred_data(size: number) {
  size /= 1024*2;
  const Units = ["B", "Kb", "Mb", "Gb", "Tb", "Pb", "Eb", "Zb", "Yb"];
  let i = 0;
  while (size >= 1024) {size /= 1024; i++;}
  const fixUnits = size.toString().match(/([0-9]+).([0-9]+)/);
  if (!!fixUnits) {
    let [unit1, unit2] = fixUnits.slice(1);
    if (unit2.length > 2) unit2 = unit2.slice(0, 2);
    size = parseFloat(`${unit1}.${unit2}`);
  }
  return {
    value: size,
    unit: Units.at(i)
  };
}