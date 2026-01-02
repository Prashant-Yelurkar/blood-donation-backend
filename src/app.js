// src/app.js
import express from "express";
import cors from "cors";

const app = express();

import loginRoute from './routes/loginRoute.js';
import roleRoute from './routes/roleRoute.js';
import userRoute from './routes/userRoute.js';
import volunteersRoute from './routes/volunteersRoute.js';
import donorRoutes from './routes/donorRoute.js'
import eventRoute from './routes/eventRoute.js'
import dashboardRoute from './routes/dashboardRoute.js';
import areaRoute from './routes/areaRoute.js';
import adminRoute from './routes/adminRoute.js';
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Blood Donation API Running");
});

app.use('/admin',adminRoute);
app.use('/area',areaRoute);
app.use('/auth',loginRoute );
app.use('/role' ,roleRoute );
app.use('/users' , userRoute );
app.use('/volunteer'  ,volunteersRoute );
app.use('/donor'  ,donorRoutes );
app.use('/event'  ,eventRoute );
app.use('/dashboard'  ,dashboardRoute );

export default app;
