import { promises as fs } from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const { city, state, country, start_date, end_date } = req.query;

  try {
    const filePath = path.resolve('stage_data.json');
    const fileContents = await fs.readFile(filePath, 'utf-8');
    const stageData = JSON.parse(fileContents);

    const filteredData = stageData.filter(studio => {
      const matchesLocation = (!city || studio.location.city.toLowerCase() === city.toLowerCase()) &&
                              (!state || studio.location.state.toLowerCase() === state.toLowerCase()) &&
                              (!country || studio.location.country.toLowerCase() === country.toLowerCase());

      if (!matchesLocation) return false;

      return studio.stages.some(stage => {
        const stageStartDate = new Date(stage.start_date);
        const stageEndDate = stage.end_date ? new Date(stage.end_date) : null;

        const queryStartDate = start_date ? new Date(start_date) : null;
        const queryEndDate = end_date ? new Date(end_date) : null;

        const availableFromQueryStart = !queryStartDate || stageEndDate === null || stageEndDate >= queryStartDate;
        const availableUntilQueryEnd = !queryEndDate || stageStartDate <= queryEndDate;

        return availableFromQueryStart && availableUntilQueryEnd;
      });
    });

    res.status(200).json(filteredData);
  } catch (error) {
    console.error("Error reading or parsing stage_data.json:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
