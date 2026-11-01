import { Router } from "express";
import { prisma } from "../config/db.js";

export const leadRouter = Router();

leadRouter.get("/:leadId/draft", async (req, res, next) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.leadId },
      select: {
        adminName: true,
        adminEmail: true,
        status: true,
        emailSubject: true,
        emailBody: true,
        school: { select: { name: true } },
        district: { select: { name: true } },
      },
    });

    if (!lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }

    if (!lead.emailSubject || !lead.emailBody) {
      res.status(409).json({ error: "An email draft has not been generated for this lead yet" });
      return;
    }

    res.json({
      recipient: { name: lead.adminName, email: lead.adminEmail },
      schoolName: lead.school?.name ?? null,
      districtName: lead.district.name,
      status: lead.status,
      subject: lead.emailSubject,
      body: lead.emailBody,
    });
  } catch (error) {
    next(error);
  }
});

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
