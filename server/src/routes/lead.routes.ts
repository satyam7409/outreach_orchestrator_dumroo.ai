import { Router } from "express";
import { prisma } from "../config/db.js";

export const leadRouter = Router();

leadRouter.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const where = {
      ...(status && ["PENDING", "PROCESSING", "SENT", "FAILED"].includes(status) ? { status: status as "PENDING" | "PROCESSING" | "SENT" | "FAILED" } : {}),
      ...(search ? { OR: [{ adminName: { contains: search, mode: "insensitive" as const } }, { adminEmail: { contains: search, mode: "insensitive" as const } }, { school: { name: { contains: search, mode: "insensitive" as const } } }, { district: { name: { contains: search, mode: "insensitive" as const } } }] } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.lead.findMany({ where, include: { school: true, district: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.lead.count({ where }),
    ]);
    res.json({ items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  } catch (error) { next(error); }
});
