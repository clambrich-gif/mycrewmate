import { beforeEach, describe, expect, it, vi } from "vitest";

const mailMocks = vi.hoisted(() => ({
  isMailDeliveryConfigured: vi.fn(),
  renderPilotInquiryNotificationEmail: vi.fn(),
  renderPilotInquiryConfirmationEmail: vi.fn(),
  sendTransactionalEmail: vi.fn(),
}));

vi.mock("./mail-service", async importOriginal => {
  const actual = await importOriginal<typeof import("./mail-service")>();
  return {
    ...actual,
    isMailDeliveryConfigured: mailMocks.isMailDeliveryConfigured,
    renderPilotInquiryNotificationEmail: mailMocks.renderPilotInquiryNotificationEmail,
    renderPilotInquiryConfirmationEmail: mailMocks.renderPilotInquiryConfirmationEmail,
    sendTransactionalEmail: mailMocks.sendTransactionalEmail,
  };
});

import { appRouter } from "./routers";
import { resetPublicPilotInquiryRateLimitForTests } from "./pilot-inquiry-rate-limit";
import type { TrpcContext } from "./_core/context";

function context(ip: string): TrpcContext {
  return {
    user: null,
    req: {
      headers: {},
      socket: { remoteAddress: ip },
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const validInquiry = {
  club: "RSC Musterstadt e. V.",
  contact: "Max Muster",
  email: "max@verein.de",
  phone: "+49 171 1234567",
  occasion: "Turnier, Rennen oder Sportevent",
  start: "2027-05",
  note: "Radsportfestival mit 120 Helfern.",
  privacy: true as const,
  website: "",
};

describe("öffentliche Pilotanfrage", () => {
  beforeEach(() => {
    resetPublicPilotInquiryRateLimitForTests();
    vi.clearAllMocks();
    mailMocks.isMailDeliveryConfigured.mockReturnValue(true);
    mailMocks.renderPilotInquiryNotificationEmail.mockReturnValue({
      subject: "Neue Pilot-Anfrage",
      text: "Interne Nachricht",
      html: "<p>Interne Nachricht</p>",
    });
    mailMocks.renderPilotInquiryConfirmationEmail.mockReturnValue({
      subject: "Bestätigung",
      text: "Bestätigung",
      html: "<p>Bestätigung</p>",
    });
    mailMocks.sendTransactionalEmail.mockResolvedValue({ success: true, simulated: false });
  });

  it("sendet die Anfrage an das Pilotteam und bestätigt sie an die anfragende Person", async () => {
    const caller = appRouter.createCaller(context("198.51.100.10"));

    await expect(caller.pilotInquiry.submit(validInquiry)).resolves.toEqual({
      accepted: true,
      confirmationSent: true,
    });

    expect(mailMocks.renderPilotInquiryNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "+49 171 1234567", desiredStart: "2027-05" })
    );
    expect(mailMocks.sendTransactionalEmail).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ to: "support@mycrewmate.de", subject: "Neue Pilot-Anfrage" })
    );
    expect(mailMocks.sendTransactionalEmail).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ to: "max@verein.de", subject: "Bestätigung" })
    );
  });

  it("akzeptiert eine Anfrage ohne freiwillige Rückrufnummer", async () => {
    const caller = appRouter.createCaller(context("198.51.100.13"));

    await expect(caller.pilotInquiry.submit({ ...validInquiry, phone: "" })).resolves.toEqual({
      accepted: true,
      confirmationSent: true,
    });
    expect(mailMocks.renderPilotInquiryNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "" })
    );
  });

  it("nimmt keine Bot-Anfrage aus dem versteckten Feld in den Versand", async () => {
    const caller = appRouter.createCaller(context("198.51.100.11"));

    await expect(caller.pilotInquiry.submit({ ...validInquiry, website: "https://bot.invalid" })).resolves.toEqual({
      accepted: true,
      confirmationSent: false,
    });
    expect(mailMocks.sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("begrenzt öffentliche Anfragen pro Herkunft", async () => {
    const caller = appRouter.createCaller(context("198.51.100.12"));

    await caller.pilotInquiry.submit(validInquiry);
    await caller.pilotInquiry.submit(validInquiry);
    await caller.pilotInquiry.submit(validInquiry);
    await expect(caller.pilotInquiry.submit(validInquiry)).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });
});
