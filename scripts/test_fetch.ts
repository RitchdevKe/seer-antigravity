import axios from 'axios';

async function testFetch() {
  try {
    const res = await axios.post('http://localhost:5173/api/nerdy/results', {
      matches: [{
        id: "test",
        teams: "Team A vs Team B",
        date: new Date().toISOString()
      }],
      dailyMatches: [],
      isJackpot: false
    });
    console.log(res.status, res.data);
  } catch (err: any) {
    console.error("Error status:", err.response?.status);
    console.error("Error data:", err.response?.data);
    console.error("Error message:", err.message);
  }
}

testFetch();
