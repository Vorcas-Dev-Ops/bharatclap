import express from 'express';
import { getStarterKits, createStarterKit, updateStarterKit, deleteStarterKit } from '../controllers/starterKitController';

const router = express.Router();

router.get('/', getStarterKits);
router.post('/', createStarterKit);
router.put('/:id', updateStarterKit);
router.delete('/:id', deleteStarterKit);

export default router;
